#!/usr/bin/env node
/**
 * Seed 10 sample vehicles with real photographs.
 *
 * Assigns every inserted vehicle to a fleet manager. The fleet manager is
 * resolved in this order:
 *   1. $FLEET_OWNER_EMAIL if set and matching a FLEET_MANAGER account
 *   2. the first FLEET_MANAGER account in the database
 *   3. the first ADMIN account (fallback so the script never inserts an
 *      ownerless vehicle, which would break the ownership model)
 *
 * Never inserts a vehicle without an owner_id.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const DB_URL = process.env.DB_URL || 'jdbc:postgresql://localhost:5432/driveease';
const DB_USER = process.env.DB_USER || 'driveease_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'driveease@123';
const OWNER_EMAIL = process.env.FLEET_OWNER_EMAIL || '';

const UPLOADS_DIR = path.resolve('uploads', 'vehicles');
const VEHICLES_JSON = path.resolve('scripts', 'vehicles.json');

function toPgConnection(jdbcUrl) {
  // jdbc:postgresql://host:port/db
  const match = jdbcUrl.match(/^jdbc:postgresql:\/\/([^:/]+):(\d+)\/(.+)$/);
  if (!match) throw new Error(`Cannot parse DB_URL: ${jdbcUrl}`);
  const [, host, port, database] = match;
  return { host, port: Number(port), database };
}

async function resolveOwnerId(client) {
  if (OWNER_EMAIL) {
    const { rows } = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND role = 'FLEET_MANAGER' LIMIT 1`,
      [OWNER_EMAIL],
    );
    if (rows[0]) return rows[0].id;
    console.warn(`FLEET_OWNER_EMAIL=${OWNER_EMAIL} did not match a fleet manager; falling back.`);
  }
  const { rows: fleetRows } = await client.query(
    `SELECT id FROM users WHERE role = 'FLEET_MANAGER' ORDER BY id LIMIT 1`,
  );
  if (fleetRows[0]) return fleetRows[0].id;

  const { rows: adminRows } = await client.query(
    `SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1`,
  );
  if (adminRows[0]) {
    console.warn(
      'No FLEET_MANAGER account found — assigning seeded vehicles to the first admin. ' +
      'Create a fleet manager and rerun V22 to reassign them.',
    );
    return adminRows[0].id;
  }
  throw new Error(
    'No FLEET_MANAGER or ADMIN account exists. Create one before running this script.',
  );
}

async function pexelsSearch(query) {
  if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY is required.');
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}"`);
  const json = await res.json();
  return json.photos?.[0]?.src?.large2x || json.photos?.[0]?.src?.large || null;
}

async function downloadImage(url, destination) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destination, buffer);
}

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function main() {
  await ensureUploadsDir();
  const vehicles = JSON.parse(await fs.readFile(VEHICLES_JSON, 'utf8'));
  const conn = toPgConnection(DB_URL);
  const pool = new Pool({ ...conn, user: DB_USER, password: DB_PASSWORD });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const ownerId = await resolveOwnerId(client);
    console.log(`Assigning seeded vehicles to user id ${ownerId}.`);

    for (const v of vehicles) {
      const { rows: existing } = await client.query(
        `SELECT id FROM vehicles WHERE license_plate = $1`,
        [v.licensePlate],
      );
      if (existing[0]) {
        console.log(`Skip ${v.licensePlate} (already exists).`);
        continue;
      }

      const slug = `${v.make}-${v.model}`.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
      const galleryUrls = [];

      for (let i = 0; i < v.imageQueries.length; i += 1) {
        const query = v.imageQueries[i];
        const file = path.join(UPLOADS_DIR, `${slug}-${i + 1}.jpg`);
        try {
          await fs.access(file);
        } catch {
          const remote = await pexelsSearch(query);
          if (remote) await downloadImage(remote, file);
        }
        galleryUrls.push(`/uploads/vehicles/${slug}-${i + 1}.jpg`);
      }

      const { rows: vehicleRows } = await client.query(
        `INSERT INTO vehicles (
           make, model, year, category, license_plate, vin, daily_rate, deposit_amount,
           status, location, mileage, seats, doors, fuel_type, transmission,
           image_url, description, features, owner_id, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           'AVAILABLE', $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, NOW(), NOW()
         ) RETURNING id`,
        [
          v.make, v.model, v.year, v.category, v.licensePlate,
          v.vin || null, v.dailyRate, v.depositAmount, v.location, v.mileage,
          v.seats, v.doors, v.fuelType, v.transmission,
          galleryUrls[0] || null, v.description,
          (v.features || []).join(', '),
          ownerId,
        ],
      );
      const vehicleId = vehicleRows[0].id;

      for (let i = 0; i < galleryUrls.length; i += 1) {
        await client.query(
          `INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order, is_primary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [vehicleId, galleryUrls[i], `${v.make} ${v.model} - view ${i + 1}`, i, i === 0],
        );
      }

      console.log(`Seeded ${v.licensePlate} → vehicle id ${vehicleId} (owner ${ownerId}).`);
    }

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

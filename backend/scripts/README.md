# Seeding sample vehicles with real photos

This folder contains a one-shot script that populates the DriveEase catalogue
with 10 sample vehicles, each carrying 8 real photographs (exterior + interior).

## One-time setup

1. **Get a free Pexels API key.** Pexels provides CC0 photographs and a
   developer API at no cost: https://www.pexels.com/api/
   Sign up, click "Your API Key", copy it.

2. **Install the Node Postgres client** (the only script dependency):

       cd backend
       npm install pg

   (No `package.json` is created — `npm` will place `pg` in `node_modules/`
   for the script to use.)

3. **Make sure the backend has been started at least once.** Flyway must have
   created the `vehicles` and `vehicle_images` tables. The script does not run
   migrations itself.

4. **Ensure the uploads directory exists and is writable.** The script creates
   it if missing, but the running backend must be able to read from the same
   path. `driveease.uploads.directory=./uploads` in `application.properties`.

## Running the script

From the `backend/` directory:

    # Windows PowerShell
    $env:PEXELS_API_KEY="your-key-here"
    $env:DB_URL="jdbc:postgresql://localhost:5432/driveease"
    $env:DB_USER="driveease_user"
    $env:DB_PASSWORD="driveease@123"
    node scripts/seed-vehicles.mjs

    # macOS / Linux
    PEXELS_API_KEY=your-key-here \
      DB_URL=jdbc:postgresql://localhost:5432/driveease \
      DB_USER=driveease_user \
      DB_PASSWORD=driveease@123 \
      node scripts/seed-vehicles.mjs

## What it does

- Reads `vehicles.json`.
- For each vehicle, resolves its 8 image search queries through the Pexels
  API and downloads the largest landscape result.
- Saves each image to `backend/uploads/vehicles/<vehicle-slug>-<n>.jpg`.
- Inserts one `vehicles` row and 8 `vehicle_images` rows in Postgres.

## Idempotency

Re-running the script is safe:

- Vehicles whose license plate already exists are skipped.
- Images that are already on disk are not re-downloaded.

So you can add more vehicle entries to `vehicles.json` and rerun — existing
ones won't be duplicated.

## Changing the fleet

Edit `vehicles.json`, delete the corresponding images from
`uploads/vehicles/` if you want fresh ones, and rerun.

## Removing the seeded data

    DELETE FROM vehicles WHERE license_plate LIKE 'KA-19-%';

Vehicle images are removed automatically by the FK cascade. Then delete the
files under `uploads/vehicles/`.

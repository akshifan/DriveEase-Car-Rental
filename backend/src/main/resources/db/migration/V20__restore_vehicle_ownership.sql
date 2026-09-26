-- =============================================================================
-- V20 : restore the vehicle-ownership columns dropped by V19
--
-- V18 added NOT NULL owner_id columns to vehicles and bookings. V19 reverted
-- them because the service layer was not yet populating them. The entity model
-- (Vehicle.owner, Booking.ownerFleet) now requires them, so this migration
-- re-adds the columns, backfills any orphaned rows, and reinstates the NOT NULL
-- constraints, foreign keys and indexes.
--
-- Idempotent: every step is guarded so the migration is safe on a database
-- that already has the columns (e.g. a fresh install where V19 never ran).
-- =============================================================================

-- 1. Vehicles: add the column if it is missing.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS owner_id BIGINT;

-- 2. Backfill: assign every ownerless vehicle to the first fleet manager.
UPDATE vehicles
SET owner_id = (
  SELECT id FROM users WHERE role = 'FLEET_MANAGER' ORDER BY id LIMIT 1
  )
WHERE owner_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'vehicles' AND column_name = 'owner_id'
               AND is_nullable = 'YES') THEN
ALTER TABLE vehicles ALTER COLUMN owner_id SET NOT NULL;
END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicles_owner') THEN
ALTER TABLE vehicles
  ADD CONSTRAINT fk_vehicles_owner
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT;
END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_vehicles_owner ON vehicles (owner_id, status);

-- 3. Bookings: same treatment, backfilled from the owning vehicle.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_id BIGINT;

UPDATE bookings b
SET owner_id = (SELECT owner_id FROM vehicles WHERE id = b.vehicle_id)
WHERE owner_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'bookings' AND column_name = 'owner_id'
               AND is_nullable = 'YES') THEN
ALTER TABLE bookings ALTER COLUMN owner_id SET NOT NULL;
END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_owner') THEN
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_owner
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT;
END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_bookings_owner ON bookings (owner_id, status, pickup_date);

COMMENT ON COLUMN vehicles.owner_id IS
  'The fleet manager who owns this vehicle. Authoritative source of fleet ownership.';
COMMENT ON COLUMN bookings.owner_id IS
  'Denormalized copy of vehicles.owner_id for fast fleet-scoped booking queries.';

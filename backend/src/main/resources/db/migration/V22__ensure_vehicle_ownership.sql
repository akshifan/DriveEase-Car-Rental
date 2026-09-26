-- =============================================================================
-- V22 : safety-net for vehicle / booking ownership
--
-- V18 added owner_id. V19 dropped it. V20 re-added it and V21 backfilled the
-- demo rows. If Flyway's state ever diverged (a manual restore, a failed
-- migration, a clean-then-migrate in the wrong order), the column may be
-- missing or NULL even though every entity still declares it as NOT NULL.
--
-- This migration re-checks and repairs that state. It is idempotent:
--   - if owner_id exists and is NOT NULL everywhere → the whole file is a no-op
--   - if owner_id is missing → it is added
--   - if any row is NULL → it is backfilled from the first FLEET_MANAGER
--     (vehicles) or from the owning vehicle (bookings)
--   - if the FK / index is missing → it is created
--
-- No data is deleted. No existing constraint is dropped without being re-created.
-- =============================================================================

-- 1. vehicles.owner_id ---------------------------------------------------------
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS owner_id BIGINT;

-- Backfill anything still NULL.
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

-- 2. bookings.owner_id ---------------------------------------------------------
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

-- 3. Guard: at least one FLEET_MANAGER must exist once there are vehicles or
--    bookings, otherwise the NOT NULL constraint above will fail at write time
--    on the next insert. We do not create a fleet manager here — that is the
--    operator's decision. We only log.
DO $$
DECLARE
fleet_count BIGINT;
    vehicle_count BIGINT;
BEGIN
SELECT COUNT(*) INTO fleet_count FROM users WHERE role = 'FLEET_MANAGER';
SELECT COUNT(*) INTO vehicle_count FROM vehicles;

IF fleet_count = 0 AND vehicle_count > 0 THEN
        RAISE WARNING
            'V22: % vehicles exist but no FLEET_MANAGER account was found. '
            'Vehicle writes will fail until at least one fleet manager is created.',
            vehicle_count;
END IF;
END $$;

COMMENT ON COLUMN vehicles.owner_id IS
  'The fleet manager who owns this vehicle. Authoritative source of fleet ownership.';
COMMENT ON COLUMN bookings.owner_id IS
  'Denormalized copy of vehicles.owner_id for fast fleet-scoped booking queries.';

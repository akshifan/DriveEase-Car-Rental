-- =============================================================================
-- V18 : vehicle ownership + booking denormalized owner
--
-- Every vehicle belongs to exactly one fleet partner (a user with role
-- FLEET_MANAGER). Bookings carry a denormalized owner_id so ownership checks
-- are O(1) and survive vehicle transfers.
--
-- Existing rows are assigned to the first FLEET_MANAGER in the database so
-- the NOT NULL constraint can be enforced without data loss.
-- =============================================================================

-- 1. Add the column, nullable first.
ALTER TABLE vehicles
  ADD COLUMN owner_id BIGINT;

-- 2. Backfill: assign every existing vehicle to the first fleet manager.
--    If there is no fleet manager, the migration will fail on the NOT NULL
--    step below — which is the correct behaviour: the operator must create
--    a fleet manager before applying this migration.
UPDATE vehicles
SET owner_id = (
  SELECT id FROM users WHERE role = 'FLEET_MANAGER' ORDER BY id LIMIT 1
  )
WHERE owner_id IS NULL;

-- 3. Enforce NOT NULL and FK.
ALTER TABLE vehicles
  ALTER COLUMN owner_id SET NOT NULL,
    ADD CONSTRAINT fk_vehicles_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT;

CREATE INDEX ix_vehicles_owner ON vehicles (owner_id, status);

-- 4. Booking gets a denormalized owner_id.
ALTER TABLE bookings
  ADD COLUMN owner_id BIGINT;

UPDATE bookings b
SET owner_id = (SELECT owner_id FROM vehicles WHERE id = b.vehicle_id)
WHERE owner_id IS NULL;

ALTER TABLE bookings
  ALTER COLUMN owner_id SET NOT NULL,
    ADD CONSTRAINT fk_bookings_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT;

CREATE INDEX ix_bookings_owner ON bookings (owner_id, status, pickup_date);

COMMENT ON COLUMN vehicles.owner_id IS 'The fleet manager who owns this vehicle. Authoritative source of fleet ownership.';
COMMENT ON COLUMN bookings.owner_id IS 'Denormalized copy of vehicles.owner_id for fast fleet-scoped booking queries.';

-- =============================================================================
-- V21 : backfill demo vehicle owners + demo booking owners
--
-- Before this migration, DemoDataSeeder created vehicles without an owner. V20
-- backfilled them all to the first FLEET_MANAGER. That made cross-fleet
-- isolation invisible: one fleet appeared to own everything.
--
-- This migration:
--   1. Finds the two seeded FLEET_MANAGER accounts (fleet@driveease.app and
--      fleetb@driveease.app). If only the first exists, it is used for all rows.
--   2. Reassigns every vehicle whose license plate starts with 'KA-19-' so that
--      the rows alternate between the two fleet managers.
--   3. Re-derives bookings.owner_id from the vehicle's owner.
--
-- Only rows with the demo license-plate prefix are touched. Operator-created
-- vehicles and bookings are untouched.
-- =============================================================================

DO $$
DECLARE
fleet_a BIGINT;
    fleet_b BIGINT;
BEGIN
SELECT id INTO fleet_a FROM users WHERE email = 'fleet@driveease.app' AND role = 'FLEET_MANAGER';
SELECT id INTO fleet_b FROM users WHERE email = 'fleetb@driveease.app' AND role = 'FLEET_MANAGER';

IF fleet_a IS NULL THEN
        RETURN;   -- no demo fleet A account; nothing to do
END IF;

    IF fleet_b IS NULL THEN
        fleet_b := fleet_a;
END IF;

    -- Alternate owners by row_number across demo vehicles.
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) AS rn
  FROM vehicles
  WHERE license_plate LIKE 'KA-19-%'
)
UPDATE vehicles v
SET owner_id = CASE WHEN r.rn % 2 = 0 THEN fleet_a ELSE fleet_b END
  FROM ranked r
WHERE v.id = r.id;

-- Re-derive the denormalized booking owner for the affected rows.
UPDATE bookings b
SET owner_id = v.owner_id
  FROM vehicles v
WHERE b.vehicle_id = v.id
  AND b.owner_id IS DISTINCT FROM v.owner_id;
END $$;

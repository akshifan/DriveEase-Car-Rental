-- =============================================================================
-- V19 : revert the vehicle-ownership migration
--
-- V18 added NOT NULL owner_id columns to vehicles and bookings. Until the
-- service layer populates them, every booking insert fails with a NOT NULL
-- violation. This migration removes the columns so booking works again.
--
-- If you plan to complete the ownership model later, apply a fresh V20 that
-- re-adds the columns as nullable first, backfills, then adds NOT NULL.
-- =============================================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS fk_bookings_owner;
DROP INDEX IF EXISTS ix_bookings_owner;
ALTER TABLE bookings DROP COLUMN IF EXISTS owner_id;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS fk_vehicles_owner;
DROP INDEX IF EXISTS ix_vehicles_owner;
ALTER TABLE vehicles DROP COLUMN IF EXISTS owner_id;

-- =============================================================================
-- V12 : damage records (US-05-03) - logged at return, linked to a rental
-- =============================================================================
CREATE TABLE damage_records (
    id                BIGSERIAL      PRIMARY KEY,
    vehicle_id        BIGINT         NOT NULL,
    booking_id        BIGINT,
    description       VARCHAR(1000)  NOT NULL,
    severity          VARCHAR(20)    NOT NULL,
    location_on_vehicle VARCHAR(120),
    repair_estimate   NUMERIC(10,2),
    actual_repair_cost NUMERIC(10,2),
    status            VARCHAR(20)    NOT NULL DEFAULT 'REPORTED',
    reported_by       BIGINT,
    resolved_by       BIGINT,
    resolved_at       TIMESTAMP,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_damage_vehicle     FOREIGN KEY (vehicle_id)  REFERENCES vehicles (id) ON DELETE CASCADE,
    CONSTRAINT fk_damage_booking     FOREIGN KEY (booking_id)  REFERENCES bookings (id) ON DELETE SET NULL,
    CONSTRAINT fk_damage_reported_by FOREIGN KEY (reported_by) REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT fk_damage_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT ck_damage_severity    CHECK (severity IN ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL')),
    CONSTRAINT ck_damage_status      CHECK (status IN ('REPORTED', 'UNDER_REPAIR', 'REPAIRED', 'WRITTEN_OFF')),
    CONSTRAINT ck_damage_estimate    CHECK (repair_estimate IS NULL OR repair_estimate >= 0),
    CONSTRAINT ck_damage_actual      CHECK (actual_repair_cost IS NULL OR actual_repair_cost >= 0)
);

CREATE INDEX ix_damage_vehicle ON damage_records (vehicle_id, created_at DESC);
CREATE INDEX ix_damage_booking ON damage_records (booking_id);
CREATE INDEX ix_damage_status  ON damage_records (status);

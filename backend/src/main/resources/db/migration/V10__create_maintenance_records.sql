-- =============================================================================
-- V11 : maintenance records (US-05-02) - a scheduled vehicle is unbookable
-- =============================================================================
CREATE TABLE maintenance_records (
    id                BIGSERIAL      PRIMARY KEY,
    vehicle_id        BIGINT         NOT NULL,
    type              VARCHAR(30)    NOT NULL,
    description       VARCHAR(500)   NOT NULL,
    scheduled_date    DATE           NOT NULL,
    completed_date    DATE,
    cost              NUMERIC(10,2)  NOT NULL DEFAULT 0,
    status            VARCHAR(20)    NOT NULL DEFAULT 'SCHEDULED',
    odometer_reading  INTEGER,
    garage            VARCHAR(200),
    created_by        BIGINT,
    completed_by      BIGINT,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_maintenance_vehicle      FOREIGN KEY (vehicle_id)   REFERENCES vehicles (id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_created_by   FOREIGN KEY (created_by)   REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_completed_by FOREIGN KEY (completed_by) REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT ck_maintenance_type         CHECK (type IN ('ROUTINE', 'REPAIR', 'INSPECTION', 'TYRES', 'SERVICE', 'OTHER')),
    CONSTRAINT ck_maintenance_status       CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_maintenance_cost         CHECK (cost >= 0)
);

CREATE INDEX ix_maintenance_vehicle ON maintenance_records (vehicle_id, scheduled_date DESC);
CREATE INDEX ix_maintenance_status  ON maintenance_records (status, scheduled_date);

-- =============================================================================
-- V6 : bookings - the core transactional table (PRD 3.3)
-- Money is NUMERIC(10,2); all arithmetic happens in BigDecimal on the JVM.
-- Date convention: the vehicle is occupied for [pickup_date, return_date),
-- which allows a same-day hand-over between two rentals.
-- =============================================================================
CREATE TABLE bookings (
    id                  BIGSERIAL      PRIMARY KEY,
    booking_reference   VARCHAR(20)    NOT NULL,
    user_id             BIGINT         NOT NULL,
    vehicle_id          BIGINT         NOT NULL,
    pickup_date         DATE           NOT NULL,
    return_date         DATE           NOT NULL,
    pickup_location     VARCHAR(200)   NOT NULL,
    return_location     VARCHAR(200)   NOT NULL,
    total_days          INTEGER        NOT NULL,
    daily_rate          NUMERIC(10,2)  NOT NULL,
    base_amount         NUMERIC(10,2)  NOT NULL,
    deposit_amount      NUMERIC(10,2)  NOT NULL,
    total_amount        NUMERIC(10,2)  NOT NULL,
    status              VARCHAR(30)    NOT NULL DEFAULT 'PENDING',
    notes               TEXT,
    actual_pickup_date  TIMESTAMP,
    actual_return_date  TIMESTAMP,
    mileage_out         INTEGER,
    mileage_in          INTEGER,
    cancelled_at        TIMESTAMP,
    cancelled_by        BIGINT,
    cancellation_reason VARCHAR(255),
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookings_user       FOREIGN KEY (user_id)       REFERENCES users (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_vehicle    FOREIGN KEY (vehicle_id)    REFERENCES vehicles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id)   ON DELETE SET NULL,
    CONSTRAINT uq_bookings_reference  UNIQUE (booking_reference),
    CONSTRAINT ck_bookings_status     CHECK (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_bookings_dates      CHECK (return_date > pickup_date),
    CONSTRAINT ck_bookings_days       CHECK (total_days = (return_date - pickup_date)),
    CONSTRAINT ck_bookings_amounts    CHECK (base_amount >= 0 AND deposit_amount >= 0 AND total_amount >= 0)
);

-- Availability / overlap lookups hit (vehicle_id, status, pickup_date, return_date).
CREATE INDEX ix_bookings_vehicle_window ON bookings (vehicle_id, status, pickup_date, return_date);
CREATE INDEX ix_bookings_user_created   ON bookings (user_id, created_at DESC);
CREATE INDEX ix_bookings_status         ON bookings (status);
CREATE INDEX ix_bookings_pickup_date    ON bookings (pickup_date);
CREATE INDEX ix_bookings_window         ON bookings (pickup_date, return_date);

COMMENT ON COLUMN bookings.status IS 'PENDING -> CONFIRMED -> ACTIVE -> COMPLETED, or CANCELLED from PENDING/CONFIRMED.';
COMMENT ON COLUMN bookings.total_amount IS 'base_amount + deposit_amount, i.e. the full amount collected at payment time.';

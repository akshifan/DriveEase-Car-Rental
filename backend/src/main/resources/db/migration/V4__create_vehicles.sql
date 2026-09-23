-- =============================================================================
-- V4 : vehicles - the fleet catalogue (PRD 3.2)
-- =============================================================================
CREATE TABLE vehicles (
    id                BIGSERIAL      PRIMARY KEY,
    make              VARCHAR(100)   NOT NULL,
    model             VARCHAR(100)   NOT NULL,
    year              INTEGER        NOT NULL,
    category          VARCHAR(50)    NOT NULL,
    license_plate     VARCHAR(20)    NOT NULL,
    vin               VARCHAR(40),
    daily_rate        NUMERIC(10,2)  NOT NULL,
    deposit_amount    NUMERIC(10,2)  NOT NULL DEFAULT 0,
    status            VARCHAR(30)    NOT NULL DEFAULT 'AVAILABLE',
    location          VARCHAR(200),
    mileage           INTEGER,
    seats             INTEGER        NOT NULL,
    doors             INTEGER,
    fuel_type         VARCHAR(20)    NOT NULL,
    transmission      VARCHAR(20)    NOT NULL,
    image_url         TEXT,
    description       TEXT,
    features          TEXT,
    retire_reason     VARCHAR(255),
    retired_at        TIMESTAMP,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_vehicles_license_plate UNIQUE (license_plate),
    CONSTRAINT uq_vehicles_vin           UNIQUE (vin),
    CONSTRAINT ck_vehicles_status        CHECK (status IN ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED')),
    CONSTRAINT ck_vehicles_category      CHECK (category IN ('ECONOMY', 'COMPACT', 'SUV', 'LUXURY', 'VAN')),
    CONSTRAINT ck_vehicles_fuel          CHECK (fuel_type IN ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID')),
    CONSTRAINT ck_vehicles_transmission  CHECK (transmission IN ('AUTOMATIC', 'MANUAL')),
    CONSTRAINT ck_vehicles_daily_rate    CHECK (daily_rate > 0),
    CONSTRAINT ck_vehicles_deposit       CHECK (deposit_amount >= 0),
    CONSTRAINT ck_vehicles_seats         CHECK (seats BETWEEN 1 AND 20),
    CONSTRAINT ck_vehicles_year          CHECK (year BETWEEN 1950 AND 2100),
    CONSTRAINT ck_vehicles_mileage       CHECK (mileage IS NULL OR mileage >= 0)
);

-- Search predicate is (status, location, category, fuel, transmission, daily_rate).
CREATE INDEX ix_vehicles_browse      ON vehicles (status, location, category, daily_rate);
CREATE INDEX ix_vehicles_category    ON vehicles (category);
CREATE INDEX ix_vehicles_location    ON vehicles (location);
CREATE INDEX ix_vehicles_fuel        ON vehicles (fuel_type);
CREATE INDEX ix_vehicles_transmission ON vehicles (transmission);
CREATE INDEX ix_vehicles_daily_rate  ON vehicles (daily_rate);
CREATE INDEX ix_vehicles_plate_lower ON vehicles (LOWER(license_plate));

COMMENT ON COLUMN vehicles.retire_reason IS 'Retirement is a soft delete and requires a reason (US-02-06).';
COMMENT ON COLUMN vehicles.features      IS 'Comma separated amenity list rendered on the vehicle detail page.';

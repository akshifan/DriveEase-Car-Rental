-- =============================================================================
-- V1 : users, roles and account state
-- PRD 3.1 - extended with address (US-01-03), licence metadata and audit columns
-- =============================================================================
CREATE TABLE users (
    id                    BIGSERIAL     PRIMARY KEY,
    email                 VARCHAR(255)  NOT NULL,
    password_hash         VARCHAR(255)  NOT NULL,
    first_name            VARCHAR(100)  NOT NULL,
    last_name             VARCHAR(100)  NOT NULL,
    phone                 VARCHAR(20),
    address               VARCHAR(255),
    city                  VARCHAR(120),
    role                  VARCHAR(20)   NOT NULL,
    license_no            VARCHAR(50),
    is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login_at         TIMESTAMP,
    created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email        UNIQUE (email),
    CONSTRAINT uq_users_license_no   UNIQUE (license_no),
    CONSTRAINT ck_users_role         CHECK (role IN ('CUSTOMER', 'FLEET_MANAGER', 'ADMIN'))
);

-- Case-insensitive login lookups while keeping the stored value untouched.
CREATE UNIQUE INDEX uq_users_email_lower   ON users (LOWER(email));
CREATE INDEX        ix_users_role_active   ON users (role, is_active);
CREATE INDEX        ix_users_created_at    ON users (created_at DESC);

COMMENT ON COLUMN users.is_active   IS 'Soft-deactivation flag; deactivated users cannot authenticate (US-01-05).';
COMMENT ON COLUMN users.license_no  IS 'Driving licence number captured at registration (US-01-01).';

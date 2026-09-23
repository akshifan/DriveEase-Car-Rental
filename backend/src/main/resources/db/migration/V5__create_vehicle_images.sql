-- =============================================================================
-- V5 : vehicle image gallery (US-02-03 carousel)
-- =============================================================================
CREATE TABLE vehicle_images (
    id           BIGSERIAL     PRIMARY KEY,
    vehicle_id   BIGINT        NOT NULL,
    url          TEXT          NOT NULL,
    alt_text     VARCHAR(255),
    display_order INTEGER      NOT NULL DEFAULT 0,
    is_primary   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vehicle_images_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE
);

CREATE INDEX ix_vehicle_images_vehicle ON vehicle_images (vehicle_id, display_order);
CREATE UNIQUE INDEX uq_vehicle_images_primary ON vehicle_images (vehicle_id) WHERE is_primary;

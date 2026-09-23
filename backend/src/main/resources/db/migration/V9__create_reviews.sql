-- =============================================================================
-- V10 : reviews (PRD 3.5) - one review per completed booking
-- =============================================================================
CREATE TABLE reviews (
    id           BIGSERIAL     PRIMARY KEY,
    user_id      BIGINT        NOT NULL,
    vehicle_id   BIGINT        NOT NULL,
    booking_id   BIGINT        NOT NULL,
    rating       INTEGER       NOT NULL,
    title        VARCHAR(150),
    comment      TEXT,
    is_deleted   BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT,
    delete_reason VARCHAR(255),
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reviews_user      FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_vehicle   FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_booking   FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id)   ON DELETE SET NULL,
    CONSTRAINT uq_reviews_booking   UNIQUE (booking_id),
    CONSTRAINT ck_reviews_rating    CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_reviews_comment   CHECK (comment IS NULL OR LENGTH(comment) <= 1000)
);

CREATE INDEX ix_reviews_vehicle ON reviews (vehicle_id, is_deleted, created_at DESC);
CREATE INDEX ix_reviews_user    ON reviews (user_id, created_at DESC);

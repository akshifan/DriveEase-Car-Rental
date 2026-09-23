-- =============================================================================
-- V14 : in-app notifications surfaced on the customer dashboard
-- =============================================================================
CREATE TABLE notifications (
    id          BIGSERIAL     PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    type        VARCHAR(40)   NOT NULL,
    title       VARCHAR(150)  NOT NULL,
    message     VARCHAR(500)  NOT NULL,
    link        VARCHAR(255),
    is_read     BOOLEAN       NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMP,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user ON notifications (user_id, is_read, created_at DESC);

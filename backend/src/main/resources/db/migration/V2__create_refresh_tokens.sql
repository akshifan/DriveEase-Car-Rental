-- =============================================================================
-- V2 : refresh tokens (opaque, rotated, delivered in an HttpOnly cookie)
-- Only a SHA-256 digest of the token is persisted - never the raw value.
-- =============================================================================
CREATE TABLE refresh_tokens (
    id             BIGSERIAL     PRIMARY KEY,
    user_id        BIGINT        NOT NULL,
    token_hash     VARCHAR(128)  NOT NULL,
    expires_at     TIMESTAMP     NOT NULL,
    revoked        BOOLEAN       NOT NULL DEFAULT FALSE,
    revoked_at     TIMESTAMP,
    replaced_by    BIGINT,
    user_agent     VARCHAR(255),
    ip_address     VARCHAR(64),
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_user        FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by) REFERENCES refresh_tokens (id) ON DELETE SET NULL,
    CONSTRAINT uq_refresh_tokens_hash        UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_tokens_user    ON refresh_tokens (user_id, revoked);
CREATE INDEX ix_refresh_tokens_expires ON refresh_tokens (expires_at);

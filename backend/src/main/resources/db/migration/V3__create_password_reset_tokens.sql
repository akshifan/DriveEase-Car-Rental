-- =============================================================================
-- V3 : single-use password reset tokens (PRD US-01-04)
-- =============================================================================
CREATE TABLE password_reset_tokens (
    id          BIGSERIAL     PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    token_hash  VARCHAR(128)  NOT NULL,
    expires_at  TIMESTAMP     NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id, used_at);

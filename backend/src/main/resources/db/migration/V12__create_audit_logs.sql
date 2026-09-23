-- =============================================================================
-- V13 : audit trail for privileged administrative operations
-- (user activation, refunds, retirement, review moderation, status changes)
-- =============================================================================
CREATE TABLE audit_logs (
    id             BIGSERIAL     PRIMARY KEY,
    actor_id       BIGINT,
    actor_email    VARCHAR(255),
    action         VARCHAR(60)   NOT NULL,
    entity_type    VARCHAR(40)   NOT NULL,
    entity_id      BIGINT,
    summary        VARCHAR(500)  NOT NULL,
    details        TEXT,
    ip_address     VARCHAR(64),
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_entity  ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX ix_audit_logs_actor   ON audit_logs (actor_id, created_at DESC);
CREATE INDEX ix_audit_logs_action  ON audit_logs (action, created_at DESC);

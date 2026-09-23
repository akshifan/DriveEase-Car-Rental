-- =============================================================================
-- V9 : refund ledger - supports full and partial refunds, one row per refund
-- =============================================================================
CREATE TABLE refunds (
    id              BIGSERIAL      PRIMARY KEY,
    refund_reference VARCHAR(40)   NOT NULL,
    payment_id      BIGINT         NOT NULL,
    booking_id      BIGINT         NOT NULL,
    amount          NUMERIC(10,2)  NOT NULL,
    reason          VARCHAR(500),
    source          VARCHAR(20)    NOT NULL,
    processed_by    BIGINT,
    status          VARCHAR(20)    NOT NULL DEFAULT 'SUCCESS',
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refunds_payment     FOREIGN KEY (payment_id)   REFERENCES payments (id) ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_booking     FOREIGN KEY (booking_id)   REFERENCES bookings (id) ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_processed_by FOREIGN KEY (processed_by) REFERENCES users (id)   ON DELETE SET NULL,
    CONSTRAINT uq_refunds_reference   UNIQUE (refund_reference),
    CONSTRAINT ck_refunds_amount      CHECK (amount > 0),
    CONSTRAINT ck_refunds_source      CHECK (source IN ('ADMIN', 'CANCELLATION')),
    CONSTRAINT ck_refunds_status      CHECK (status IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX ix_refunds_payment ON refunds (payment_id);
CREATE INDEX ix_refunds_booking ON refunds (booking_id);
CREATE INDEX ix_refunds_created ON refunds (created_at DESC);

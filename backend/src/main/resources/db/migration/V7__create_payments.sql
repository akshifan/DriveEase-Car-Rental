-- =============================================================================
-- V8 ordering note: payments (PRD 3.4) + refund ledger (US-04-04)
-- Card numbers, CVVs and provider credentials are NEVER persisted.
-- =============================================================================
CREATE TABLE payments (
    id                BIGSERIAL      PRIMARY KEY,
    payment_reference VARCHAR(40)    NOT NULL,
    booking_id        BIGINT         NOT NULL,
    user_id           BIGINT         NOT NULL,
    amount            NUMERIC(10,2)  NOT NULL,
    currency          VARCHAR(3)     NOT NULL DEFAULT 'INR',
    payment_method    VARCHAR(30)    NOT NULL,
    transaction_ref   VARCHAR(100)   NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    failure_reason    VARCHAR(255),
    card_last4        VARCHAR(4),
    paid_at           TIMESTAMP,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_booking   FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_user      FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE RESTRICT,
    CONSTRAINT uq_payments_reference UNIQUE (payment_reference),
    CONSTRAINT uq_payments_txn_ref   UNIQUE (transaction_ref),
    CONSTRAINT ck_payments_status    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    CONSTRAINT ck_payments_method    CHECK (payment_method IN ('CARD', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'CASH')),
    CONSTRAINT ck_payments_amount    CHECK (amount > 0)
);

CREATE INDEX ix_payments_booking ON payments (booking_id);
CREATE INDEX ix_payments_user    ON payments (user_id, created_at DESC);
CREATE INDEX ix_payments_status  ON payments (status);
CREATE INDEX ix_payments_paid_at ON payments (paid_at);

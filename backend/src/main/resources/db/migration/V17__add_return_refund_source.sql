-- =============================================================================
-- V17 : add RETURN to the refund source enum + idempotency guarantee
--
-- Two changes:
--   1. The refund source list gains RETURN, used by the automatic deposit
--      release when a rental ends cleanly.
--   2. A partial unique index ensures at most one SUCCESS refund per
--      (payment_id, source). RETURN and CANCELLATION are one-shot; ADMIN
--      refunds can still be issued multiple times.
-- =============================================================================

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS ck_refunds_source;

ALTER TABLE refunds
  ADD CONSTRAINT ck_refunds_source
    CHECK (source IN ('ADMIN', 'CANCELLATION', 'RETURN'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_payment_source_success
  ON refunds (payment_id, source)
  WHERE status = 'SUCCESS';

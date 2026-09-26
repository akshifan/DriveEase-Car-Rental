-- =============================================================================
-- V16 : add RETURN to the refund source enum
--
-- A rental that ends cleanly now triggers an automatic deposit refund through
-- the internal (non-admin) path. That refund is recorded with source=RETURN
-- so the ledger distinguishes it from cancellations and admin overrides.
-- =============================================================================

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS ck_refunds_source;

ALTER TABLE refunds
  ADD CONSTRAINT ck_refunds_source
    CHECK (source IN ('ADMIN', 'CANCELLATION', 'RETURN'));

-- =============================================================================
-- V15 : aggregation helpers for the reporting endpoints (US-04-05, US-05-05)
-- Revenue counts SUCCESS payments net of refunds; utilisation compares rented
-- days against the days the vehicle was actually part of the bookable fleet.
-- =============================================================================

CREATE INDEX ix_bookings_reporting   ON bookings (status, pickup_date, return_date, vehicle_id);
CREATE INDEX ix_payments_reporting   ON payments (status, paid_at, booking_id);
CREATE INDEX ix_refunds_reporting    ON refunds (status, created_at, payment_id);

-- Booking level revenue view: one row per booking with money already netted.
CREATE OR REPLACE VIEW v_booking_revenue AS
SELECT b.id                                      AS booking_id,
       b.booking_reference,
       b.user_id,
       b.vehicle_id,
       v.category                                AS vehicle_category,
       v.location                                AS branch,
       b.pickup_date,
       b.return_date,
       b.total_days,
       b.status                                  AS booking_status,
       COALESCE(p.paid_amount, 0)::NUMERIC(12,2)  AS paid_amount,
       COALESCE(r.refunded_amount, 0)::NUMERIC(12,2) AS refunded_amount,
       (COALESCE(p.paid_amount, 0) - COALESCE(r.refunded_amount, 0))::NUMERIC(12,2) AS net_revenue,
       COALESCE(p.paid_at, b.created_at)          AS recognised_at
FROM bookings b
JOIN vehicles v ON v.id = b.vehicle_id
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS paid_amount, MIN(paid_at) AS paid_at
    FROM payments WHERE status IN ('SUCCESS', 'REFUNDED') GROUP BY booking_id
) p ON p.booking_id = b.id
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS refunded_amount FROM refunds WHERE status = 'SUCCESS' GROUP BY booking_id
) r ON r.booking_id = b.id
WHERE b.status <> 'CANCELLED';

COMMENT ON VIEW v_booking_revenue IS 'Per-booking revenue after refunds; powers /reports/revenue aggregations.';

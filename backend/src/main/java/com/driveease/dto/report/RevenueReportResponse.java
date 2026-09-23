package com.driveease.dto.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** GET /reports/revenue (PRD US-04-05). All figures come from database aggregation. */
public record RevenueReportResponse(
        LocalDate from,
        LocalDate to,
        String groupBy,
        String currency,
        Totals totals,
        List<RevenuePoint> series,
        List<RevenueGroup> byCategory,
        List<RevenueGroup> byBranch,
        List<RevenuePoint> byMonth
) {
    public record RevenuePoint(String key, String label, BigDecimal revenue, long bookings, BigDecimal refunds) {
    }

    public record RevenueGroup(String key, BigDecimal revenue, long bookings, BigDecimal averageBookingValue) {
    }

    public record Totals(
            BigDecimal grossRevenue,
            BigDecimal refunds,
            BigDecimal netRevenue,
            long paidBookings,
            long cancelledBookings,
            long pendingBookings,
            long failedPayments,
            BigDecimal averageBookingValue,
            BigDecimal depositHeld
    ) {
    }
}

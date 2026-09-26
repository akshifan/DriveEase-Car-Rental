package com.driveease.dto.report;

import java.math.BigDecimal;

/**
 * Money view for a single fleet partner: what has been collected for their
 * vehicles, minus refunds, plus the current outstanding "live" rental value.
 */
public record FleetPaymentSummary(
    long ownerId,
    String ownerName,
    String ownerEmail,
    long totalPayments,
    BigDecimal grossCollected,
    BigDecimal refunded,
    BigDecimal netCollected,
    BigDecimal completedRentalRevenue,
    BigDecimal activeRentalRevenue,
    long completedBookings
) {
}

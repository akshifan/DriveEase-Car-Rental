package com.driveease.dto.payment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * POST /fleet/bookings/{id}/refund-deposit
 *
 * <p>Used by the owning fleet after a rental is completed with damage. The
 * refund is capped at the original refundable deposit minus whatever has
 * already been refunded. A reason is mandatory so the customer, the fleet and
 * the audit trail all have the same story.</p>
 */
public record FleetRefundRequest(
    @DecimalMin(value = "0.01", message = "Refund amount must be positive")
    @Digits(integer = 8, fraction = 2)
    BigDecimal amount,

    @NotBlank(message = "A reason is required")
    @Size(max = 500)
    String reason
) {
}

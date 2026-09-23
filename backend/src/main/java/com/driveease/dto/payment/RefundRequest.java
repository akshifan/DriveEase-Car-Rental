package com.driveease.dto.payment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * POST /payments/{id}/refund (PRD US-04-04).
 * Omitting {@code amount} issues a full refund of the remaining balance.
 */
public record RefundRequest(
        @DecimalMin(value = "0.01", message = "Refund amount must be positive")
        @Digits(integer = 8, fraction = 2)
        BigDecimal amount,

        @NotBlank(message = "A refund reason is required")
        @Size(max = 500) String reason
) {
}

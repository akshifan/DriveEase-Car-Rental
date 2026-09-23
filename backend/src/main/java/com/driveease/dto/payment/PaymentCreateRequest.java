package com.driveease.dto.payment;

import com.driveease.entity.PaymentMethod;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/**
 * POST /payments - PRD US-04-01.
 *
 * <p>Only the last four digits of a card may be supplied; full PAN data, CVV and
 * expiry are rejected by the DTO contract and never stored.</p>
 */
public record PaymentCreateRequest(
        @NotNull(message = "Booking is required") Long bookingId,

        @Digits(integer = 8, fraction = 2)
        @DecimalMin(value = "0.01", message = "Amount must be positive")
        BigDecimal amount,

        @NotNull(message = "Payment method is required") PaymentMethod paymentMethod,

        @Size(max = 19, message = "Only the last four digits may be supplied")
        @Pattern(regexp = "^$|^\\d{4}$", message = "Card reference must be the last four digits")
        String cardLast4,

        @Size(max = 60) String upiId,
        @Size(max = 120) String idempotencyKey
) {
}

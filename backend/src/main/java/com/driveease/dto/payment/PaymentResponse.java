package com.driveease.dto.payment;

import com.driveease.entity.PaymentMethod;
import com.driveease.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id,
        String paymentReference,
        String transactionRef,
        Long bookingId,
        String bookingReference,
        BigDecimal amount,
        BigDecimal refundedAmount,
        String currency,
        PaymentMethod paymentMethod,
        PaymentStatus status,
        String failureReason,
        String cardLast4,
        LocalDateTime paidAt,
        LocalDateTime createdAt
) {
}

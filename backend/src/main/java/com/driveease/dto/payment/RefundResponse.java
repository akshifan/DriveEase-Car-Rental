package com.driveease.dto.payment;

import com.driveease.entity.RefundSource;
import com.driveease.entity.RefundStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record RefundResponse(
        Long id,
        String refundReference,
        Long paymentId,
        String paymentReference,
        Long bookingId,
        String bookingReference,
        BigDecimal amount,
        String reason,
        RefundSource source,
        RefundStatus status,
        Long processedBy,
        String processedByName,
        LocalDateTime createdAt
) {
}

package com.driveease.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** GET /payments/{id} - payment plus a printable receipt summary (US-04-03). */
public record PaymentDetailResponse(
        Long id,
        String paymentReference,
        String transactionRef,
        BigDecimal amount,
        BigDecimal refundedAmount,
        BigDecimal netAmount,
        String currency,
        String paymentMethod,
        String status,
        String cardLast4,
        LocalDateTime paidAt,
        Receipt receipt,
        List<RefundResponse> refunds
) {
    public record Receipt(
            String receiptNumber,
            String customerName,
            String customerEmail,
            String bookingReference,
            String vehicleName,
            String vehicleLicensePlate,
            String pickupLocation,
            String returnLocation,
            LocalDate pickupDate,
            LocalDate returnDate,
            Integer totalDays,
            BigDecimal baseAmount,
            BigDecimal depositAmount,
            BigDecimal totalAmount,
            LocalDateTime issuedAt
    ) {
    }
}

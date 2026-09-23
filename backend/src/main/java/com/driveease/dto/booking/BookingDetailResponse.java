package com.driveease.dto.booking;

import com.driveease.dto.payment.PaymentResponse;
import com.driveease.dto.review.ReviewResponse;
import com.driveease.entity.BookingStatus;
import com.driveease.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** GET /bookings/{id} - full detail incl. itemised costs (PRD US-03-03). */
public record BookingDetailResponse(
        Long id,
        String bookingReference,
        BookingStatus status,
        BookingVehicleSummary vehicle,
        BookingCustomerSummary customer,
        LocalDate pickupDate,
        LocalDate returnDate,
        String pickupLocation,
        String returnLocation,
        Integer totalDays,
        BigDecimal dailyRate,
        BigDecimal baseAmount,
        BigDecimal depositAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal refundedAmount,
        PaymentStatus paymentStatus,
        String notes,
        LocalDateTime actualPickupDate,
        LocalDateTime actualReturnDate,
        Integer mileageOut,
        Integer mileageIn,
        LocalDateTime cancelledAt,
        String cancellationReason,
        List<PaymentResponse> payments,
        ReviewResponse review,
        List<StatusHistoryEntry> history,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record StatusHistoryEntry(String status, String label, LocalDateTime occurredAt, boolean complete) {
    }
}

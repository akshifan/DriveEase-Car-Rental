package com.driveease.dto.booking;

import com.driveease.entity.BookingStatus;
import com.driveease.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** List-level booking projection. */
public record BookingResponse(
        Long id,
        String bookingReference,
        BookingVehicleSummary vehicle,
        LocalDate pickupDate,
        LocalDate returnDate,
        String pickupLocation,
        String returnLocation,
        Integer totalDays,
        BigDecimal baseAmount,
        BigDecimal depositAmount,
        BigDecimal totalAmount,
        BookingStatus status,
        PaymentStatus paymentStatus,
        boolean cancellable,
        boolean reviewable,
        boolean reviewed,
        LocalDateTime createdAt
) {
}

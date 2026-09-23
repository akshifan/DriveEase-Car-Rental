package com.driveease.dto.booking;

import com.driveease.entity.BookingStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * PATCH /bookings/{id}/status - fleet manager workflow step.
 * Only CONFIRMED -> ACTIVE (pickup) and ACTIVE -> COMPLETED (return) are
 * accepted here; anything else is rejected with 409 by the BookingService.
 */
public record BookingStatusUpdateRequest(
        @NotNull(message = "Status is required") BookingStatus status,
        @Min(value = 0, message = "Mileage cannot be negative") Integer mileage,
        @Size(max = 255) String note
) {
}

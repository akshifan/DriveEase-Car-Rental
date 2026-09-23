package com.driveease.dto.booking;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

/** POST /bookings (PRD US-03-01). */
public record BookingCreateRequest(
        @NotNull(message = "Vehicle is required") Long vehicleId,

        @NotNull(message = "Pickup date is required")
        @FutureOrPresent(message = "Pickup date cannot be in the past")
        LocalDate pickupDate,

        @NotNull(message = "Return date is required")
        @Future(message = "Return date must be in the future")
        LocalDate returnDate,

        @NotBlank(message = "Pickup location is required") @Size(max = 200) String pickupLocation,
        @NotBlank(message = "Return location is required") @Size(max = 200) String returnLocation,
        @Size(max = 500) String notes
) {
}

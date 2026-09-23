package com.driveease.dto.booking;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** POST /bookings/quote - price preview before a booking exists. */
public record PriceQuoteRequest(
        @NotNull Long vehicleId,
        @NotNull LocalDate pickupDate,
        @NotNull LocalDate returnDate
) {
}

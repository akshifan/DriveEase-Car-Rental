package com.driveease.dto.review;

import jakarta.validation.constraints.*;

/** POST /reviews (PRD US-06-01). */
public record ReviewCreateRequest(
        @NotNull(message = "Booking is required") Long bookingId,

        @NotNull(message = "Rating is required")
        @Min(value = 1, message = "Rating must be between 1 and 5")
        @Max(value = 5, message = "Rating must be between 1 and 5")
        Integer rating,

        @Size(max = 150) String title,
        @Size(max = 1000, message = "Comment cannot exceed 1000 characters") String comment
) {
}

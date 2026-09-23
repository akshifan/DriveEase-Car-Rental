package com.driveease.dto.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BookingCancellationRequest(
        @NotBlank(message = "Please tell us why you are cancelling")
        @Size(max = 255) String reason
) {
}

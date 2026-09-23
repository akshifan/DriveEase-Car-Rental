package com.driveease.dto.vehicle;

import com.driveease.entity.VehicleStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VehicleStatusRequest(
        @NotNull(message = "Status is required") VehicleStatus status,
        @Size(max = 255) String reason
) {
}

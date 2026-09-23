package com.driveease.dto.vehicle;

import com.driveease.entity.DamageSeverity;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/** POST /vehicles/{id}/damage (PRD US-05-03). */
public record DamageRequest(
        @NotBlank(message = "Description is required") @Size(max = 1000) String description,
        @NotNull(message = "Severity is required") DamageSeverity severity,
        @Size(max = 120) String locationOnVehicle,
        Long bookingId,
        @DecimalMin(value = "0.00") @Digits(integer = 8, fraction = 2) BigDecimal repairEstimate
) {
}

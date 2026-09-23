package com.driveease.dto.vehicle;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MaintenanceCompleteRequest(
        LocalDate completedDate,
        @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal cost,
        @Min(0) Integer odometerReading,
        @Size(max = 500) String notes,
        Boolean releaseVehicle
) {
}

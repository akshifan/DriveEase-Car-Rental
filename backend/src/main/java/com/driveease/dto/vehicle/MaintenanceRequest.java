package com.driveease.dto.vehicle;

import com.driveease.entity.MaintenanceType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MaintenanceRequest(
        @NotNull(message = "Maintenance type is required") MaintenanceType type,
        @NotBlank(message = "Description is required") @Size(max = 500) String description,
        @NotNull(message = "Scheduled date is required") LocalDate scheduledDate,
        @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal cost,
        @Min(0) Integer odometerReading,
        @Size(max = 200) String garage
) {
}

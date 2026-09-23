package com.driveease.dto.vehicle;

import com.driveease.entity.MaintenanceStatus;
import com.driveease.entity.MaintenanceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MaintenanceResponse(
        Long id,
        Long vehicleId,
        String vehicleName,
        String licensePlate,
        MaintenanceType type,
        String description,
        LocalDate scheduledDate,
        LocalDate completedDate,
        BigDecimal cost,
        MaintenanceStatus status,
        Integer odometerReading,
        String garage,
        Long createdBy,
        LocalDateTime createdAt
) {
}

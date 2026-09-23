package com.driveease.dto.vehicle;

import com.driveease.entity.DamageSeverity;
import com.driveease.entity.DamageStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DamageResponse(
        Long id,
        Long vehicleId,
        String vehicleName,
        String licensePlate,
        Long bookingId,
        String bookingReference,
        String description,
        DamageSeverity severity,
        String locationOnVehicle,
        BigDecimal repairEstimate,
        BigDecimal actualRepairCost,
        DamageStatus status,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
}

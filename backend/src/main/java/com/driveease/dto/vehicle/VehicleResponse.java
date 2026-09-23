package com.driveease.dto.vehicle;

import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import com.driveease.entity.VehicleStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Compact catalogue projection used by cards and list endpoints. */
public record VehicleResponse(
        Long id,
        String make,
        String model,
        String displayName,
        Integer year,
        VehicleCategory category,
        String licensePlate,
        BigDecimal dailyRate,
        BigDecimal depositAmount,
        VehicleStatus status,
        String location,
        Integer mileage,
        Integer seats,
        Integer doors,
        FuelType fuelType,
        Transmission transmission,
        String imageUrl,
        String description,
        boolean bookable,
        Double averageRating,
        Long reviewCount,
        LocalDateTime createdAt
) {
}

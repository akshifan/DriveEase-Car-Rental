package com.driveease.dto.vehicle;

import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import com.driveease.entity.VehicleStatus;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/** PATCH /vehicles/{id} - every field optional (PRD US-02-05). */
public record VehicleUpdateRequest(
        @Size(max = 100) String make,
        @Size(max = 100) String model,
        @Min(1950) @Max(2100) Integer year,
        VehicleCategory category,
        @Size(max = 20) String licensePlate,
        @Size(max = 40) String vin,
        @DecimalMin(value = "1.00") @Digits(integer = 8, fraction = 2) BigDecimal dailyRate,
        @DecimalMin(value = "0.00") @Digits(integer = 8, fraction = 2) BigDecimal depositAmount,
        VehicleStatus status,
        @Size(max = 200) String location,
        @Min(0) Integer mileage,
        @Min(1) @Max(20) Integer seats,
        @Min(1) @Max(9) Integer doors,
        FuelType fuelType,
        Transmission transmission,
        String imageUrl,
        List<String> galleryUrls,
        @Size(max = 2000) String description,
        List<String> features,
        @Size(max = 255) String statusReason
) {
}

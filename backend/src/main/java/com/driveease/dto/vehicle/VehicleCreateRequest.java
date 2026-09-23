package com.driveease.dto.vehicle;

import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/** POST /vehicles - required fields per PRD US-02-04. */
public record VehicleCreateRequest(
        @NotBlank(message = "Make is required") @Size(max = 100) String make,
        @NotBlank(message = "Model is required") @Size(max = 100) String model,

        @NotNull(message = "Year is required")
        @Min(value = 1950, message = "Year looks too old")
        @Max(value = 2100, message = "Year looks too far ahead")
        Integer year,

        @NotNull(message = "Category is required") VehicleCategory category,
        @NotBlank(message = "License plate is required") @Size(max = 20) String licensePlate,
        @Size(max = 40) String vin,

        @NotNull(message = "Daily rate is required")
        @DecimalMin(value = "1.00", message = "Daily rate must be greater than zero")
        @Digits(integer = 8, fraction = 2, message = "Daily rate accepts at most 2 decimals")
        BigDecimal dailyRate,

        @DecimalMin(value = "0.00", message = "Deposit cannot be negative")
        @Digits(integer = 8, fraction = 2)
        BigDecimal depositAmount,

        @Size(max = 200) String location,
        @Min(value = 0, message = "Mileage cannot be negative") Integer mileage,
        @NotNull(message = "Seats are required") @Min(1) @Max(20) Integer seats,
        @Min(1) @Max(9) Integer doors,
        @NotNull(message = "Fuel type is required") FuelType fuelType,
        @NotNull(message = "Transmission is required") Transmission transmission,
        String imageUrl,
        List<String> galleryUrls,
        @Size(max = 2000) String description,
        List<String> features
) {
}

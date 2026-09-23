package com.driveease.dto.booking;

import com.driveease.entity.VehicleCategory;

import java.math.BigDecimal;

public record BookingVehicleSummary(
        Long id,
        String make,
        String model,
        String displayName,
        VehicleCategory category,
        String imageUrl,
        String licensePlate,
        String location
) {
}

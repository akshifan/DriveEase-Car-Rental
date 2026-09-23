package com.driveease.dto.vehicle;

import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import com.driveease.entity.VehicleStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** GET /vehicles/{id} - full detail page payload (PRD US-02-03). */
public record VehicleDetailResponse(
        Long id,
        String make,
        String model,
        String displayName,
        Integer year,
        VehicleCategory category,
        String licensePlate,
        String vin,
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
        List<String> features,
        List<VehicleImageResponse> gallery,
        boolean bookable,
        String unavailableReason,
        Double averageRating,
        Long reviewCount,
        Map<Integer, Long> ratingDistribution,
        int activeBookings,
        LocalDate nextAvailableFrom,
        List<VehicleAvailabilityWindow> upcomingAvailability,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record VehicleAvailabilityWindow(LocalDate pickupDate, LocalDate returnDate) {
    }
}

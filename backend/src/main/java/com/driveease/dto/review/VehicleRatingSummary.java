package com.driveease.dto.review;

import java.util.Map;

public record VehicleRatingSummary(
        Long vehicleId,
        Double averageRating,
        long reviewCount,
        Map<Integer, Long> distribution
) {
}

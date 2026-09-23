package com.driveease.dto.vehicle;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** GET /vehicles/{id}/history (US-05-04) - a merged, reverse-chronological timeline. */
public record VehicleHistoryResponse(
        Long vehicleId,
        String displayName,
        String licensePlate,
        List<HistoryEvent> events,
        Summary summary
) {
    public record HistoryEvent(
            String type,
            Long referenceId,
            String reference,
            String title,
            String description,
            LocalDate date,
            LocalDateTime timestamp,
            String status,
            BigDecimal amount
    ) {
    }

    public record Summary(
            long totalBookings,
            long completedBookings,
            long cancelledBookings,
            long maintenanceRecords,
            long damageRecords,
            BigDecimal lifetimeRevenue,
            BigDecimal maintenanceCost,
            BigDecimal damageCost,
            Integer currentMileage
    ) {
    }
}

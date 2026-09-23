package com.driveease.dto.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** GET /reports/utilisation (PRD US-05-05): rented days / available rental days. */
public record UtilisationReportResponse(
        LocalDate from,
        LocalDate to,
        int periodDays,
        BigDecimal fleetUtilisationPercent,
        long fleetRentedDays,
        long fleetAvailableDays,
        List<VehicleUtilisation> vehicles
) {
    public record VehicleUtilisation(
            Long vehicleId,
            String vehicleName,
            String licensePlate,
            String category,
            String location,
            long rentedDays,
            long availableDays,
            long bookingCount,
            BigDecimal utilisationPercent,
            BigDecimal revenue,
            String status
    ) {
    }
}

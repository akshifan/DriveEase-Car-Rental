package com.driveease.dto.report;

import com.driveease.entity.BookingStatus;

import java.time.LocalDate;

/** Query parameters accepted by the admin CSV export. */
public record CsvExportRequest(
        BookingStatus status,
        LocalDate startDate,
        LocalDate endDate,
        Long vehicleId,
        Long userId,
        String search
) {
}

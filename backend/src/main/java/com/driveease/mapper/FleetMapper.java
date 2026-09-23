package com.driveease.mapper;

import com.driveease.dto.vehicle.DamageResponse;
import com.driveease.dto.vehicle.MaintenanceResponse;
import com.driveease.entity.DamageRecord;
import com.driveease.entity.MaintenanceRecord;
import org.springframework.stereotype.Component;

@Component
public class FleetMapper {

    public MaintenanceResponse toResponse(MaintenanceRecord record) {
        if (record == null) {
            return null;
        }
        return new MaintenanceResponse(
                record.getId(),
                record.getVehicle().getId(),
                record.getVehicle().displayName(),
                record.getVehicle().getLicensePlate(),
                record.getType(),
                record.getDescription(),
                record.getScheduledDate(),
                record.getCompletedDate(),
                record.getCost(),
                record.getStatus(),
                record.getOdometerReading(),
                record.getGarage(),
                record.getCreatedBy(),
                record.getCreatedAt());
    }

    public DamageResponse toResponse(DamageRecord record) {
        if (record == null) {
            return null;
        }
        return new DamageResponse(
                record.getId(),
                record.getVehicle().getId(),
                record.getVehicle().displayName(),
                record.getVehicle().getLicensePlate(),
                record.getBooking() == null ? null : record.getBooking().getId(),
                record.getBooking() == null ? null : record.getBooking().getBookingReference(),
                record.getDescription(),
                record.getSeverity(),
                record.getLocationOnVehicle(),
                record.getRepairEstimate(),
                record.getActualRepairCost(),
                record.getStatus(),
                record.getCreatedAt(),
                record.getResolvedAt());
    }
}

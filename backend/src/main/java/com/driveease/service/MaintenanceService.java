package com.driveease.service;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.vehicle.MaintenanceCompleteRequest;
import com.driveease.dto.vehicle.MaintenanceRequest;
import com.driveease.dto.vehicle.MaintenanceResponse;
import com.driveease.entity.*;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.mapper.FleetMapper;
import com.driveease.repository.*;
import com.driveease.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Maintenance scheduling (PRD US-05-02). Scheduling maintenance immediately takes
 * the vehicle out of the bookable pool by moving it to MAINTENANCE; completing the
 * job releases it back to AVAILABLE unless it was retired in the meantime.
 */
@Service
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);

    private final MaintenanceRecordRepository maintenanceRepository;
    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final FleetMapper fleetMapper;

    public MaintenanceService(MaintenanceRecordRepository maintenanceRepository,
                              VehicleRepository vehicleRepository,
                              BookingRepository bookingRepository,
                              AuditService auditService,
                              NotificationService notificationService,
                              FleetMapper fleetMapper) {
        this.maintenanceRepository = maintenanceRepository;
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.fleetMapper = fleetMapper;
    }

    @Transactional
    public MaintenanceResponse schedule(Long vehicleId, MaintenanceRequest request) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", vehicleId));
        if (vehicle.getStatus() == VehicleStatus.RETIRED) {
            throw InvalidRequestException.unprocessable("VEHICLE_RETIRED",
                    "A retired vehicle cannot be scheduled for maintenance.");
        }
        if (vehicle.getStatus() == VehicleStatus.RENTED) {
            throw InvalidRequestException.unprocessable("VEHICLE_ON_RENT",
                    "This vehicle is currently on rent. Schedule maintenance after it is returned.");
        }

        MaintenanceRecord record = new MaintenanceRecord();
        record.setVehicle(vehicle);
        record.setType(request.type());
        record.setDescription(request.description().trim());
        record.setScheduledDate(request.scheduledDate());
        record.setCost(request.cost() == null ? BigDecimal.ZERO : PricingService.money(request.cost()));
        record.setOdometerReading(request.odometerReading());
        record.setGarage(request.garage());
        record.setStatus(request.scheduledDate().isAfter(LocalDate.now())
                ? MaintenanceStatus.SCHEDULED : MaintenanceStatus.IN_PROGRESS);
        record.setCreatedBy(SecurityUtils.currentUserOrNull() == null ? null : SecurityUtils.currentUserId());
        maintenanceRepository.save(record);

        // Vehicle leaves the bookable pool while it is being serviced.
        if (vehicle.getStatus() == VehicleStatus.AVAILABLE && vehicle.getStatus().canTransitionTo(VehicleStatus.MAINTENANCE)) {
            vehicle.setStatus(VehicleStatus.MAINTENANCE);
            vehicleRepository.save(vehicle);
        }

        auditService.record(AuditAction.MAINTENANCE_SCHEDULED, "Vehicle", vehicleId,
                "Maintenance scheduled for " + vehicle.getLicensePlate() + " (" + request.type() + ")",
                request.description());
        warnAboutConfirmedBookings(vehicle, record);
        log.info("Maintenance {} scheduled for vehicle {}", record.getId(), vehicle.getLicensePlate());
        return fleetMapper.toResponse(record);
    }

    /** Existing confirmed bookings are flagged, never silently cancelled (PRD US-05-02). */
    private void warnAboutConfirmedBookings(Vehicle vehicle, MaintenanceRecord record) {
        bookingRepository.findByVehicleIdWithVehicle(vehicle.getId()).stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED && !b.getReturnDate().isBefore(record.getScheduledDate()))
                .forEach(booking -> notificationService.notifyUser(booking.getUser().getId(),
                        NotificationType.ACCOUNT_STATUS,
                        "Maintenance scheduled on your vehicle",
                        "The " + vehicle.displayName() + " for booking " + booking.getBookingReference()
                                + " has entered the workshop. Our team will contact you if the pickup needs to change.",
                        "/bookings/" + booking.getBookingReference()));
    }

    @Transactional
    public MaintenanceResponse complete(Long maintenanceId, MaintenanceCompleteRequest request) {
        MaintenanceRecord record = maintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Maintenance record", maintenanceId));
        if (record.getStatus() == MaintenanceStatus.COMPLETED) {
            throw InvalidRequestException.unprocessable("MAINTENANCE_ALREADY_COMPLETED",
                    "This maintenance record is already completed.");
        }

        record.setStatus(MaintenanceStatus.COMPLETED);
        record.setCompletedDate(request != null && request.completedDate() != null
                ? request.completedDate() : LocalDate.now());
        if (request != null && request.cost() != null) {
            record.setCost(PricingService.money(request.cost()));
        }
        if (request != null && request.odometerReading() != null) {
            record.setOdometerReading(request.odometerReading());
        }
        record.setCompletedBy(SecurityUtils.currentUserOrNull() == null ? null : SecurityUtils.currentUserId());
        maintenanceRepository.save(record);

        Vehicle vehicle = record.getVehicle();
        boolean release = request == null || request.releaseVehicle() == null || request.releaseVehicle();
        if (release && vehicle.getStatus() == VehicleStatus.MAINTENANCE) {
            vehicle.setStatus(VehicleStatus.AVAILABLE);
            if (request != null && request.odometerReading() != null) {
                vehicle.setMileage(request.odometerReading());
            }
            vehicleRepository.save(vehicle);
        } else if (!release) {
            log.info("Maintenance {} completed but vehicle {} kept off the road",
                    maintenanceId, vehicle.getLicensePlate());
        }

        auditService.record(AuditAction.VEHICLE_STATUS_CHANGED, "Vehicle", vehicle.getId(),
                "Maintenance completed for " + vehicle.getLicensePlate(),
                "cost=" + record.getCost() + ", released=" + release);
        return fleetMapper.toResponse(record);
    }

    @Transactional(readOnly = true)
    public PageResponse<MaintenanceResponse> list(Pageable pageable) {
        return PageResponse.of(maintenanceRepository.findAllByOrderByScheduledDateDesc(pageable), fleetMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public List<MaintenanceResponse> forVehicle(Long vehicleId) {
        return maintenanceRepository.findByVehicleIdOrderByScheduledDateDesc(vehicleId).stream()
                .map(fleetMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public long scheduledCount() {
        return maintenanceRepository.countByStatus(MaintenanceStatus.SCHEDULED)
                + maintenanceRepository.countByStatus(MaintenanceStatus.IN_PROGRESS);
    }
}

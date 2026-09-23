package com.driveease.service;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.vehicle.DamageRequest;
import com.driveease.dto.vehicle.DamageResponse;
import com.driveease.dto.vehicle.DamageStatusRequest;
import com.driveease.entity.*;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.mapper.FleetMapper;
import com.driveease.repository.BookingRepository;
import com.driveease.repository.DamageRecordRepository;
import com.driveease.repository.VehicleRepository;
import com.driveease.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Damage logging at return (PRD US-05-03). */
@Service
public class DamageService {

    private static final Logger log = LoggerFactory.getLogger(DamageService.class);

    private final DamageRecordRepository damageRepository;
    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;
    private final FleetMapper fleetMapper;

    public DamageService(DamageRecordRepository damageRepository,
                         VehicleRepository vehicleRepository,
                         BookingRepository bookingRepository,
                         AuditService auditService,
                         FleetMapper fleetMapper) {
        this.damageRepository = damageRepository;
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
        this.fleetMapper = fleetMapper;
    }

    @Transactional
    public DamageResponse log(Long vehicleId, DamageRequest request) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", vehicleId));

        Booking booking = null;
        if (request.bookingId() != null) {
            booking = bookingRepository.findDetailById(request.bookingId())
                    .orElseThrow(() -> new ResourceNotFoundException("Booking", request.bookingId()));
            if (!booking.getVehicle().getId().equals(vehicleId)) {
                throw InvalidRequestException.unprocessable("DAMAGE_BOOKING_MISMATCH",
                        "Booking " + booking.getBookingReference() + " does not belong to this vehicle.");
            }
        }

        DamageRecord record = new DamageRecord();
        record.setVehicle(vehicle);
        record.setBooking(booking);
        record.setDescription(request.description().trim());
        record.setSeverity(request.severity());
        record.setLocationOnVehicle(request.locationOnVehicle());
        record.setRepairEstimate(request.repairEstimate());
        record.setStatus(DamageStatus.REPORTED);
        record.setReportedBy(SecurityUtils.currentUserOrNull() == null ? null : SecurityUtils.currentUserId());
        damageRepository.save(record);

        // Critical damage parks the car until a workshop assessment is done.
        if (request.severity() == DamageSeverity.CRITICAL
                && vehicle.getStatus() == VehicleStatus.AVAILABLE
                && vehicle.getStatus().canTransitionTo(VehicleStatus.MAINTENANCE)) {
            vehicle.setStatus(VehicleStatus.MAINTENANCE);
            vehicleRepository.save(vehicle);
            log.info("Vehicle {} parked after CRITICAL damage report", vehicle.getLicensePlate());
        }

        auditService.record(AuditAction.DAMAGE_LOGGED, "Vehicle", vehicleId,
                "Damage logged for " + vehicle.getLicensePlate() + " (" + request.severity() + ")",
                request.description());
        return fleetMapper.toResponse(record);
    }

    @Transactional
    public DamageResponse updateStatus(Long damageId, DamageStatusRequest request) {
        DamageRecord record = damageRepository.findById(damageId)
                .orElseThrow(() -> new ResourceNotFoundException("Damage record", damageId));
        record.setStatus(request.status());
        if (request.actualRepairCost() != null) {
            record.setActualRepairCost(request.actualRepairCost());
        }
        if (request.status() == DamageStatus.REPAIRED || request.status() == DamageStatus.WRITTEN_OFF) {
            record.setResolvedAt(LocalDateTime.now());
            record.setResolvedBy(SecurityUtils.currentUserOrNull() == null ? null : SecurityUtils.currentUserId());
        }
        damageRepository.save(record);
        auditService.record(AuditAction.VEHICLE_STATUS_CHANGED, "Damage", damageId,
                "Damage record " + damageId + " moved to " + request.status(), null);
        return fleetMapper.toResponse(record);
    }

    @Transactional(readOnly = true)
    public PageResponse<DamageResponse> list(Pageable pageable) {
        return PageResponse.of(damageRepository.findAllByOrderByCreatedAtDesc(pageable), fleetMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public List<DamageResponse> forVehicle(Long vehicleId) {
        return damageRepository.findByVehicleIdOrderByCreatedAtDesc(vehicleId).stream()
                .map(fleetMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public long openCount() {
        return damageRepository.countByStatus(DamageStatus.REPORTED)
                + damageRepository.countByStatus(DamageStatus.UNDER_REPAIR);
    }
}

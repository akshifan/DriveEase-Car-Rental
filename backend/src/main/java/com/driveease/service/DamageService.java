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
import com.driveease.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Damage logging at return (PRD US-05-03). Scoped to the caller's fleet. */
@Service
public class DamageService {

    private static final Logger log = LoggerFactory.getLogger(DamageService.class);

    private final DamageRecordRepository damageRepository;
    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;
    private final FleetMapper fleetMapper;
    private final FleetAccessGuard fleetAccessGuard;

    public DamageService(DamageRecordRepository damageRepository,
                         VehicleRepository vehicleRepository,
                         BookingRepository bookingRepository,
                         AuditService auditService,
                         FleetMapper fleetMapper,
                         FleetAccessGuard fleetAccessGuard) {
        this.damageRepository = damageRepository;
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
        this.fleetMapper = fleetMapper;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    @Transactional
    public DamageResponse log(Long vehicleId, DamageRequest request, UserPrincipal principal) {
        Vehicle vehicle = requireOwnedVehicle(vehicleId, principal);

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
        record.setReportedBy(principal.getId());
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
    public DamageResponse updateStatus(Long damageId, DamageStatusRequest request, UserPrincipal principal) {
        DamageRecord record = damageRepository.findById(damageId)
            .orElseThrow(() -> new ResourceNotFoundException("Damage record", damageId));
        requireOwnedVehicle(record.getVehicle().getId(), principal);

        record.setStatus(request.status());
        if (request.actualRepairCost() != null) {
            record.setActualRepairCost(request.actualRepairCost());
        }
        if (request.status() == DamageStatus.REPAIRED || request.status() == DamageStatus.WRITTEN_OFF) {
            record.setResolvedAt(LocalDateTime.now());
            record.setResolvedBy(principal.getId());
        }
        damageRepository.save(record);
        auditService.record(AuditAction.VEHICLE_STATUS_CHANGED, "Damage", damageId,
            "Damage record " + damageId + " moved to " + request.status(), null);
        return fleetMapper.toResponse(record);
    }

    @Transactional(readOnly = true)
    public PageResponse<DamageResponse> list(UserPrincipal principal, Pageable pageable) {
        fleetAccessGuard.requireFleetOwner(principal);
        return PageResponse.of(
            damageRepository.findByVehicleOwnerIdOrderByCreatedAtDesc(principal.getId(), pageable),
            fleetMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public List<DamageResponse> forVehicle(Long vehicleId, UserPrincipal principal) {
        requireOwnedVehicle(vehicleId, principal);
        return damageRepository.findByVehicleIdOrderByCreatedAtDesc(vehicleId).stream()
            .map(fleetMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public long openCount() {
        return damageRepository.countByStatus(DamageStatus.REPORTED)
            + damageRepository.countByStatus(DamageStatus.UNDER_REPAIR);
    }

    /**
     * Loads a vehicle, enforcing fleet ownership. Both FLEET_MANAGER and ADMIN
     * may own vehicles; both are scoped to their own fleet. Cross-fleet access
     * returns 404 so IDs cannot be probed.
     */
    private Vehicle requireOwnedVehicle(Long vehicleId, UserPrincipal principal) {
        fleetAccessGuard.requireFleetOwner(principal);
        return vehicleRepository.findByIdAndOwner(vehicleId, principal.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle", vehicleId));
    }
}

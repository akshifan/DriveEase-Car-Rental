package com.driveease.service;

import com.driveease.dto.vehicle.VehicleHistoryResponse;
import com.driveease.entity.*;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.repository.*;
import com.driveease.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Merged vehicle timeline: rentals, maintenance and damage (PRD US-05-04). Fleet-scoped. */
@Service
public class VehicleHistoryService {

    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final MaintenanceRecordRepository maintenanceRepository;
    private final DamageRecordRepository damageRepository;
    private final PaymentRepository paymentRepository;
    private final FleetAccessGuard fleetAccessGuard;

    public VehicleHistoryService(VehicleRepository vehicleRepository,
                                 BookingRepository bookingRepository,
                                 MaintenanceRecordRepository maintenanceRepository,
                                 DamageRecordRepository damageRepository,
                                 PaymentRepository paymentRepository,
                                 FleetAccessGuard fleetAccessGuard) {
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.maintenanceRepository = maintenanceRepository;
        this.damageRepository = damageRepository;
        this.paymentRepository = paymentRepository;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    @Transactional(readOnly = true)
    public VehicleHistoryResponse history(Long vehicleId, UserPrincipal principal) {
        Vehicle vehicle = requireOwnedVehicle(vehicleId, principal);

        List<VehicleHistoryResponse.HistoryEvent> events = new ArrayList<>();
        List<Booking> bookings = bookingRepository.findByVehicleIdWithVehicle(vehicleId);

        long completed = 0;
        long cancelled = 0;
        BigDecimal lifetimeRevenue = BigDecimal.ZERO;

        for (Booking booking : bookings) {
            switch (booking.getStatus()) {
                case COMPLETED -> completed++;
                case CANCELLED -> cancelled++;
                default -> { }
            }
            BigDecimal paid = paymentRepository.findByBookingId(booking.getId()).stream()
                .filter(p -> p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.REFUNDED)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (booking.getStatus() == BookingStatus.COMPLETED) {
                lifetimeRevenue = lifetimeRevenue.add(paid);
            }
            events.add(new VehicleHistoryResponse.HistoryEvent(
                "BOOKING",
                booking.getId(),
                booking.getBookingReference(),
                "Rental - " + booking.getUser().fullName(),
                booking.getPickupLocation() + " -> " + booking.getReturnLocation(),
                booking.getPickupDate(),
                booking.getCreatedAt(),
                booking.getStatus().name(),
                paid));
        }

        BigDecimal maintenanceCost = BigDecimal.ZERO;
        List<MaintenanceRecord> maintenance = maintenanceRepository.findByVehicleIdOrderByScheduledDateDesc(vehicleId);
        for (MaintenanceRecord record : maintenance) {
            maintenanceCost = maintenanceCost.add(record.getCost() == null ? BigDecimal.ZERO : record.getCost());
            events.add(new VehicleHistoryResponse.HistoryEvent(
                "MAINTENANCE",
                record.getId(),
                "MTC-" + record.getId(),
                record.getType() + " - " + record.getGarage(),
                record.getDescription(),
                record.getScheduledDate(),
                record.getCreatedAt(),
                record.getStatus().name(),
                record.getCost()));
        }

        BigDecimal damageCost = BigDecimal.ZERO;
        List<DamageRecord> damages = damageRepository.findByVehicleIdOrderByCreatedAtDesc(vehicleId);
        for (DamageRecord record : damages) {
            BigDecimal cost = record.getActualRepairCost() != null
                ? record.getActualRepairCost() : record.getRepairEstimate();
            damageCost = damageCost.add(cost == null ? BigDecimal.ZERO : cost);
            events.add(new VehicleHistoryResponse.HistoryEvent(
                "DAMAGE",
                record.getId(),
                record.getBooking() == null ? "DAM-" + record.getId() : record.getBooking().getBookingReference(),
                record.getSeverity() + " damage",
                record.getDescription() + (record.getLocationOnVehicle() == null
                    ? "" : " (" + record.getLocationOnVehicle() + ")"),
                record.getCreatedAt() == null ? null : record.getCreatedAt().toLocalDate(),
                record.getCreatedAt(),
                record.getStatus().name(),
                cost));
        }

        events.sort(Comparator.comparing(
            (VehicleHistoryResponse.HistoryEvent event) ->
                event.timestamp() == null ? LocalDateTime.MIN : event.timestamp()).reversed());

        VehicleHistoryResponse.Summary summary = new VehicleHistoryResponse.Summary(
            bookings.size(), completed, cancelled, maintenance.size(), damages.size(),
            lifetimeRevenue, maintenanceCost, damageCost, vehicle.getMileage());

        return new VehicleHistoryResponse(vehicle.getId(), vehicle.displayName(), vehicle.getLicensePlate(),
            events, summary);
    }

    private Vehicle requireOwnedVehicle(Long vehicleId, UserPrincipal principal) {
        fleetAccessGuard.requireFleetOwner(principal);
        return vehicleRepository.findByIdAndOwner(vehicleId, principal.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle", vehicleId));
    }
}

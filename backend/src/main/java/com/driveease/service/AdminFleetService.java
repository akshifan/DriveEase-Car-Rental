package com.driveease.service;

import com.driveease.dto.report.FleetPaymentSummary;
import com.driveease.entity.Role;
import com.driveease.entity.User;
import com.driveease.repository.BookingRepository;
import com.driveease.repository.PaymentRepository;
import com.driveease.repository.UserRepository;
import com.driveease.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Administrative view of every fleet partner on the platform.
 *
 * For each FLEET_MANAGER this returns: how many vehicles they own, how many
 * bookings their vehicles have taken, and how much money has been collected
 * for their vehicles (net of refunds). Admins use this to answer "which fleet
 * owns which booking" without joining tables in their head.
 */
@Service
public class AdminFleetService {

    private final UserRepository userRepository;
    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;

    public AdminFleetService(UserRepository userRepository,
                             VehicleRepository vehicleRepository,
                             BookingRepository bookingRepository,
                             PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
    }

    public record FleetRow(
        Long id,
        String fullName,
        String email,
        String company,
        long vehicleCount,
        long bookingCount,
        long completedBookings,
        BigDecimal grossCollected,
        BigDecimal refunded,
        BigDecimal netCollected
    ) {
    }

    @Transactional(readOnly = true)
    public List<FleetRow> listAllFleets() {
        List<User> fleets = userRepository.findAll().stream()
            .filter(u -> u.getRole() == Role.FLEET_MANAGER)
            .toList();

        Map<Long, long[]> completedByOwner = new HashMap<>();
        for (Object[] row : bookingRepository.completedAggregatesByOwner()) {
            if (row[0] == null) continue;
            long ownerId = ((Number) row[0]).longValue();
            long completedCount = ((Number) row[1]).longValue();
            completedByOwner.put(ownerId, new long[]{completedCount});
        }

        List<FleetRow> rows = new ArrayList<>(fleets.size());
        for (User fleet : fleets) {
            long vehicleCount = vehicleRepository.countByOwnerId(fleet.getId());
            long bookingCount = bookingRepository.countByOwnerFleetId(fleet.getId());
            long completed = completedByOwner.getOrDefault(fleet.getId(), new long[]{0L})[0];
            BigDecimal gross = nz(paymentRepository.sumCollectedForOwner(fleet.getId()));
            BigDecimal refunded = nz(paymentRepository.sumRefundedForOwner(fleet.getId()));
            BigDecimal net = gross.subtract(refunded);
            rows.add(new FleetRow(
                fleet.getId(),
                fleet.fullName(),
                fleet.getEmail(),
                fleet.getAddress(),
                vehicleCount,
                bookingCount,
                completed,
                gross,
                refunded,
                net));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public FleetPaymentSummary summaryForFleet(Long ownerId) {
        User owner = userRepository.findById(ownerId).orElseThrow();
        BigDecimal gross = nz(paymentRepository.sumCollectedForOwner(ownerId));
        BigDecimal refunded = nz(paymentRepository.sumRefundedForOwner(ownerId));
        BigDecimal net = gross.subtract(refunded);
        long payments = paymentRepository
            .findByFleetOwnerIdOrderByCreatedAtDesc(ownerId,
                org.springframework.data.domain.Pageable.unpaged()).getTotalElements();
        return new FleetPaymentSummary(
            owner.getId(), owner.fullName(), owner.getEmail(),
            payments,
            gross, refunded, net,
            nz(bookingRepository.sumCompletedRentalRevenueForOwner(ownerId)),
            nz(bookingRepository.sumActiveRentalRevenueForOwner(ownerId)),
            bookingRepository.countCompletedForOwner(ownerId));
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}

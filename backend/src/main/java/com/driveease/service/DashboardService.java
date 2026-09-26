package com.driveease.service;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.payment.PaymentResponse;
import com.driveease.dto.report.DashboardResponse;
import com.driveease.dto.report.RevenueReportResponse;
import com.driveease.dto.review.ReviewResponse;
import com.driveease.entity.*;
import com.driveease.mapper.*;
import com.driveease.repository.*;
import com.driveease.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Role dashboards. Each number is derived from the database at request time.
 *
 * <ul>
 *   <li>{@link #customerDashboard(Long)} — the customer's own summary.</li>
 *   <li>{@link #fleetDashboard(UserPrincipal)} — the caller's own fleet, whether
 *       that caller is a FLEET_MANAGER or an ADMIN acting as fleet owner.</li>
 *   <li>{@link #adminDashboard()} — platform-wide aggregates, admin-only.</li>
 * </ul>
 */
@Service
public class DashboardService {

    private final UserRepository userRepository;
    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final ReviewRepository reviewRepository;
    private final MaintenanceRecordRepository maintenanceRepository;
    private final DamageRecordRepository damageRepository;
    private final BookingService bookingService;
    private final ReportService reportService;
    private final BookingMapper bookingMapper;
    private final PaymentMapper paymentMapper;
    private final ReviewMapper reviewMapper;
    private final FleetMapper fleetMapper;
    private final NotificationService notificationService;
    private final FleetAccessGuard fleetAccessGuard;

    public DashboardService(UserRepository userRepository,
                            VehicleRepository vehicleRepository,
                            BookingRepository bookingRepository,
                            PaymentRepository paymentRepository,
                            RefundRepository refundRepository,
                            ReviewRepository reviewRepository,
                            MaintenanceRecordRepository maintenanceRepository,
                            DamageRecordRepository damageRepository,
                            BookingService bookingService,
                            ReportService reportService,
                            BookingMapper bookingMapper,
                            PaymentMapper paymentMapper,
                            ReviewMapper reviewMapper,
                            FleetMapper fleetMapper,
                            NotificationService notificationService,
                            FleetAccessGuard fleetAccessGuard) {
        this.userRepository = userRepository;
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.reviewRepository = reviewRepository;
        this.maintenanceRepository = maintenanceRepository;
        this.damageRepository = damageRepository;
        this.bookingService = bookingService;
        this.reportService = reportService;
        this.bookingMapper = bookingMapper;
        this.paymentMapper = paymentMapper;
        this.reviewMapper = reviewMapper;
        this.fleetMapper = fleetMapper;
        this.notificationService = notificationService;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    // --------------------------------------------------------------- customer

    @Transactional(readOnly = true)
    public DashboardResponse.CustomerDashboard customerDashboard(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        List<Booking> bookings = bookingRepository.findByUserIdOrderByPickupDateDesc(userId,
            org.springframework.data.domain.PageRequest.of(0, 200)).getContent();
        LocalDate today = LocalDate.now();

        List<BookingResponse> mapped = bookings.stream()
            .map(b -> bookingMapper.toResponse(b, bookingService.paymentStatusOf(b), bookingService.reviewed(b)))
            .toList();

        BookingResponse current = mapped.stream()
            .filter(b -> (b.status() == BookingStatus.ACTIVE)
                || (b.status() == BookingStatus.CONFIRMED && !b.returnDate().isBefore(today)))
            .findFirst()
            .orElse(null);

        List<BookingResponse> upcoming = mapped.stream()
            .filter(b -> b.status() == BookingStatus.CONFIRMED || b.status() == BookingStatus.PENDING)
            .filter(b -> !b.returnDate().isBefore(today))
            .sorted(Comparator.comparing(BookingResponse::pickupDate))
            .limit(5)
            .toList();

        BigDecimal lifetimeSpend = paymentRepository.findByUserIdOrderByCreatedAtDesc(userId,
                org.springframework.data.domain.PageRequest.of(0, 500)).getContent().stream()
            .filter(p -> p.getStatus() == PaymentStatus.SUCCESS)
            .map(Payment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<PaymentResponse> recentPayments = paymentRepository
            .findByUserIdOrderByCreatedAtDesc(userId, org.springframework.data.domain.PageRequest.of(0, 5))
            .getContent().stream()
            .map(p -> paymentMapper.toResponse(p, BigDecimal.ZERO))
            .toList();

        List<BookingResponse> reviewable = mapped.stream()
            .filter(b -> b.status() == BookingStatus.COMPLETED && !b.reviewed())
            .limit(5)
            .toList();

        return new DashboardResponse.CustomerDashboard(
            current, upcoming, bookings.size(),
            bookings.stream().filter(b -> b.getStatus() == BookingStatus.COMPLETED).count(),
            bookings.stream().filter(b -> b.getStatus() == BookingStatus.ACTIVE).count(),
            bookings.stream().filter(b -> b.getStatus() == BookingStatus.CANCELLED).count(),
            lifetimeSpend, notificationService.unreadCount(userId),
            recentPayments, reviewable);
    }

    // ------------------------------------------------------------------ fleet

    /**
     * Fleet dashboard. Scoped to the caller's own fleet — for both
     * FLEET_MANAGER and ADMIN acting as fleet owner.
     *
     * <p>Returns a well-formed empty payload when the caller owns zero
     * vehicles, so the frontend never has to null-check nested fields.</p>
     */
    @Transactional(readOnly = true)
    public DashboardResponse.FleetDashboard fleetDashboard(UserPrincipal principal) {
        fleetAccessGuard.requireFleetOwner(principal);
        Long ownerId = principal.getId();

        Map<String, Long> statusCounts = new LinkedHashMap<>();
        long totalVehicles = 0;
        for (VehicleStatus status : VehicleStatus.values()) {
            long count = vehicleRepository.countByOwnerIdAndStatus(ownerId, status);
            statusCounts.put(status.name(), count);
            totalVehicles += count;
        }

        LocalDate today = LocalDate.now();

        // Early return: an owner with no vehicles gets a clean, empty dashboard.
        if (totalVehicles == 0) {
            return new DashboardResponse.FleetDashboard(
                statusCounts,
                0L,
                0L, 0L, 0,
                0L, 0L,
                BigDecimal.ZERO,
                round(vehicleRepository.averageDailyRate()),
                BigDecimal.ZERO,
                List.of(),
                List.of(),
                List.of(),
                List.of()
            );
        }

        List<Booking> upcoming = bookingRepository.findByOwnerFleetIdAndStatus(
            ownerId,
            BookingStatus.CONFIRMED,
            org.springframework.data.domain.PageRequest.of(
                0, 8, org.springframework.data.domain.Sort.by("pickupDate"))
        ).getContent();

        List<DashboardResponse.FleetDashboard.VehicleStatusRow> rows = new ArrayList<>();
        List<Vehicle> fleet = vehicleRepository
            .findByOwnerId(ownerId, org.springframework.data.domain.Pageable.unpaged()).getContent();

        Map<Long, Booking> nextByVehicle = new HashMap<>();
        for (Booking booking : bookingRepository.findLiveBookings(today)) {
            if (booking == null || booking.getVehicle() == null
                || booking.getVehicle().getId() == null) continue;
            if (booking.getOwnerFleet() == null
                || !booking.getOwnerFleet().getId().equals(ownerId)) continue;
            nextByVehicle.merge(booking.getVehicle().getId(), booking,
                (a, b) -> a.getPickupDate().isBefore(b.getPickupDate()) ? a : b);
        }

        Map<Long, Long> completedByVehicle = new HashMap<>();
        for (Object[] row : bookingRepository.completedCountsByVehicle()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            completedByVehicle.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }

        for (Vehicle vehicle : fleet) {
            Booking next = nextByVehicle.get(vehicle.getId());
            long completed = completedByVehicle.getOrDefault(vehicle.getId(), 0L);
            rows.add(new DashboardResponse.FleetDashboard.VehicleStatusRow(
                vehicle.getId(), vehicle.displayName(), vehicle.getLicensePlate(),
                vehicle.getCategory() == null ? "" : vehicle.getCategory().name(),
                vehicle.getStatus() == null ? "" : vehicle.getStatus().name(),
                vehicle.getLocation(), vehicle.getMileage(), vehicle.getDailyRate(),
                next == null ? null : next.getPickupDate(),
                next == null ? null : next.getBookingReference(),
                completed));
        }
        rows.sort(Comparator.comparing(
            DashboardResponse.FleetDashboard.VehicleStatusRow::displayName));

        BigDecimal fleetValue = fleet.stream()
            .filter(v -> v.getStatus() != VehicleStatus.RETIRED)
            .map(Vehicle::getDailyRate)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .multiply(BigDecimal.valueOf(30));

        BigDecimal utilisation = reportService
            .utilisationForOwner(ownerId)
            .fleetUtilisationPercent();

        long activeBookings = bookingRepository
            .countByOwnerFleetIdAndStatus(ownerId, BookingStatus.ACTIVE);
        long pendingConfirmations = bookingRepository
            .countByOwnerFleetIdAndStatus(ownerId, BookingStatus.PENDING);

        return new DashboardResponse.FleetDashboard(
            statusCounts, totalVehicles,
            activeBookings, pendingConfirmations, upcoming.size(),
            damageRepository.countByStatus(DamageStatus.REPORTED)
                + damageRepository.countByStatus(DamageStatus.UNDER_REPAIR),
            maintenanceRepository.countByStatus(MaintenanceStatus.SCHEDULED)
                + maintenanceRepository.countByStatus(MaintenanceStatus.IN_PROGRESS),
            fleetValue, round(vehicleRepository.averageDailyRate()), utilisation,
            rows,
            upcoming.stream().map(b -> bookingMapper.toResponse(b,
                bookingService.paymentStatusOf(b), bookingService.reviewed(b))).toList(),
            maintenanceRepository.findAllByOrderByScheduledDateDesc(
                    org.springframework.data.domain.PageRequest.of(0, 5))
                .getContent().stream()
                .filter(r -> r.getVehicle() != null
                    && r.getVehicle().getOwner() != null
                    && r.getVehicle().getOwner().getId().equals(ownerId))
                .map(fleetMapper::toResponse).toList(),
            damageRepository.findAllByOrderByCreatedAtDesc(
                    org.springframework.data.domain.PageRequest.of(0, 5))
                .getContent().stream()
                .filter(r -> r.getVehicle() != null
                    && r.getVehicle().getOwner() != null
                    && r.getVehicle().getOwner().getId().equals(ownerId))
                .map(fleetMapper::toResponse).toList());
    }

    // ------------------------------------------------------------------ admin

    @Transactional(readOnly = true)
    public DashboardResponse.AdminDashboard adminDashboard() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByActiveTrue();
        long customers = userRepository.countByRole(Role.CUSTOMER);
        long fleetManagers = userRepository.countByRole(Role.FLEET_MANAGER);
        long admins = userRepository.countByRole(Role.ADMIN);

        Map<String, Long> vehicleStatusCounts = new LinkedHashMap<>();
        long totalVehicles = 0;
        for (VehicleStatus status : VehicleStatus.values()) {
            long count = vehicleRepository.countByStatus(status);
            vehicleStatusCounts.put(status.name(), count);
            totalVehicles += count;
        }

        Map<String, Long> bookingStatusCounts = new LinkedHashMap<>();
        long totalBookings = 0;
        for (BookingStatus status : BookingStatus.values()) {
            long count = bookingRepository.countByStatus(status);
            bookingStatusCounts.put(status.name(), count);
            totalBookings += count;
        }

        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(29);
        RevenueReportResponse revenue = reportService.revenue(from, today, "day", null, null);
        LocalDateTime currentFrom = today.minusDays(29).atStartOfDay();
        LocalDateTime currentTo = today.plusDays(1).atStartOfDay();
        LocalDateTime previousFrom = today.minusDays(59).atStartOfDay();
        LocalDateTime previousTo = today.minusDays(29).atStartOfDay();

        BigDecimal collected = nz(paymentRepository.sumCollected(currentFrom, currentTo));
        BigDecimal previousCollected = nz(paymentRepository.sumCollected(previousFrom, previousTo));
        BigDecimal refunded = nz(refundRepository.sumRefundedBetween(currentFrom, currentTo));

        List<BookingResponse> recentBookings = bookingRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 8,
                    org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")))
            .getContent().stream()
            .map(b -> bookingMapper.toResponse(b, bookingService.paymentStatusOf(b), bookingService.reviewed(b)))
            .toList();

        List<ReviewResponse> recentReviews = reviewRepository.findAllByOrderByCreatedAtDesc(
                org.springframework.data.domain.PageRequest.of(0, 5)).getContent().stream()
            .map(reviewMapper::toOwnerResponse).toList();

        Double averageRating = reviewRepository.overallAverageRating();

        return new DashboardResponse.AdminDashboard(
            totalUsers, activeUsers, customers, fleetManagers, admins,
            vehicleStatusCounts, totalVehicles,
            bookingStatusCounts, totalBookings,
            revenue.totals().grossRevenue(),
            revenue.totals().netRevenue(),
            refunded, collected, previousCollected,
            revenue.totals().averageBookingValue(),
            paymentRepository.countByStatus(PaymentStatus.FAILED),
            refundRepository.countBySourceAndStatus(RefundSource.CANCELLATION, RefundStatus.SUCCESS)
                + refundRepository.countBySourceAndStatus(RefundSource.ADMIN, RefundStatus.SUCCESS),
            reviewRepository.countByDeletedFalse(),
            round(averageRating),
            utilisationSummary().percent(),
            recentBookings,
            refundRepository.findAllByOrderByCreatedAtDesc(
                    org.springframework.data.domain.PageRequest.of(0, 5)).getContent().stream()
                .map(paymentMapper::toResponse).toList(),
            recentReviews,
            revenue.series());
    }

    private record UtilisationSummary(BigDecimal percent) { }

    private UtilisationSummary utilisationSummary() {
        LocalDate from = LocalDate.now().minusDays(29);
        LocalDate to = LocalDate.now();
        return new UtilisationSummary(reportService.utilisation(from, to, null).fleetUtilisationPercent());
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Double round(Double value) {
        return value == null ? 0d : VehicleMapper.round(value);
    }
}

package com.driveease.service;

import com.driveease.dto.booking.*;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.common.PricingBreakdown;
import com.driveease.dto.payment.PaymentResponse;
import com.driveease.entity.*;
import com.driveease.exception.*;
import com.driveease.mapper.BookingMapper;
import com.driveease.mapper.PaymentMapper;
import com.driveease.mapper.ReviewMapper;
import com.driveease.mapper.VehicleMapper;
import com.driveease.repository.*;
import com.driveease.repository.spec.BookingSpecifications;
import com.driveease.security.UserPrincipal;
import com.driveease.util.DateUtils;
import com.driveease.util.ReferenceGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Booking engine - the critical business module.
 *
 * <pre>
 * create()            -> PENDING   (vehicle stays AVAILABLE, window is held)
 * pay + gateway ok    -> CONFIRMED (still AVAILABLE, reserved)
 * pickup (fleet)      -> ACTIVE    (vehicle becomes RENTED)
 * return (fleet)      -> COMPLETED (vehicle becomes AVAILABLE again; deposit auto-refunded if no damage)
 * cancel              -> CANCELLED (from PENDING or CONFIRMED, refund minus flat ₹200 fee)
 * </pre>
 *
 * Ownership: every booking captures the vehicle's owning user at creation time
 * in {@code ownerFleet}. Fleet-scoped reads and updates go through
 * {@link #requireAccessibleBooking(Long, UserPrincipal)}.
 *
 * The fleet console is scoped to {@code principal.getId()} for both
 * FLEET_MANAGER and ADMIN. An admin's fleet is whatever vehicles they own;
 * platform-wide reporting lives in {@link DashboardService#adminDashboard()}.
 */
@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final BookingRepository bookingRepository;
    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final ReviewRepository reviewRepository;
    private final DamageRecordRepository damageRepository;
    private final PricingService pricingService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final ReferenceGenerator referenceGenerator;
    private final BookingMapper bookingMapper;
    private final PaymentMapper paymentMapper;
    private final ReviewMapper reviewMapper;
    private final VehicleMapper vehicleMapper;
    private final RefundService refundService;
    private final FleetAccessGuard fleetAccessGuard;

    public BookingService(BookingRepository bookingRepository,
                          VehicleRepository vehicleRepository,
                          UserRepository userRepository,
                          PaymentRepository paymentRepository,
                          ReviewRepository reviewRepository,
                          DamageRecordRepository damageRepository,
                          PricingService pricingService,
                          NotificationService notificationService,
                          AuditService auditService,
                          ReferenceGenerator referenceGenerator,
                          BookingMapper bookingMapper,
                          PaymentMapper paymentMapper,
                          ReviewMapper reviewMapper,
                          VehicleMapper vehicleMapper,
                          RefundService refundService,
                          FleetAccessGuard fleetAccessGuard) {
        this.bookingRepository = bookingRepository;
        this.vehicleRepository = vehicleRepository;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
        this.reviewRepository = reviewRepository;
        this.damageRepository = damageRepository;
        this.pricingService = pricingService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.referenceGenerator = referenceGenerator;
        this.bookingMapper = bookingMapper;
        this.paymentMapper = paymentMapper;
        this.reviewMapper = reviewMapper;
        this.vehicleMapper = vehicleMapper;
        this.refundService = refundService;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    // ------------------------------------------------------------------ create

    @Transactional
    public BookingDetailResponse create(Long userId, BookingCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (!user.isActive()) {
            throw new InsufficientPermissionException("This account is deactivated and cannot create bookings.");
        }

        // Pessimistic lock serialises concurrent attempts on the same vehicle.
        Vehicle vehicle = vehicleRepository.findByIdForUpdate(request.vehicleId())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle", request.vehicleId()));

        if (vehicle.getStatus() == VehicleStatus.RETIRED) {
            throw new VehicleUnavailableException("This vehicle has been retired from the fleet.");
        }
        if (vehicle.getStatus() == VehicleStatus.MAINTENANCE) {
            throw new VehicleUnavailableException("This vehicle is currently in maintenance and cannot be booked.");
        }
        if (vehicle.getStatus() == VehicleStatus.RENTED) {
            LocalDate currentEnd = currentRentalEnd(vehicle.getId());
            if (currentEnd != null && request.pickupDate().isBefore(currentEnd)) {
                throw new VehicleUnavailableException(
                    "This vehicle is on rent until " + currentEnd + " and cannot be booked for the requested dates.");
            }
        }

        assertNoOverlap(vehicle.getId(), request.pickupDate(), request.returnDate(), null);

        PricingBreakdown pricing = pricingService.quote(vehicle, request.pickupDate(), request.returnDate());

        // Retry on a unique-constraint collision for the booking reference.
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                Booking booking = new Booking();
                booking.setBookingReference(referenceGenerator.bookingReference(request.pickupDate()));
                booking.setUser(user);
                booking.setVehicle(vehicle);
                // Authoritative owner: derived from the vehicle, never from the request.
                booking.setOwnerFleet(vehicle.getOwner());
                booking.setPickupDate(request.pickupDate());
                booking.setReturnDate(request.returnDate());
                booking.setPickupLocation(request.pickupLocation().trim());
                booking.setReturnLocation(request.returnLocation().trim());
                booking.setNotes(request.notes());
                booking.setTotalDays(pricing.totalDays());
                booking.setDailyRate(pricing.dailyRate());
                booking.setBaseAmount(pricing.baseAmount());
                booking.setDepositAmount(pricing.depositAmount());
                booking.setTotalAmount(pricing.totalAmount());
                booking.setStatus(BookingStatus.PENDING);

                Booking saved = bookingRepository.saveAndFlush(booking);
                notificationService.onBookingCreated(saved);
                log.info("Booking {} created for user {} vehicle {} ({} -> {})",
                    saved.getBookingReference(), userId, vehicle.getId(),
                    saved.getPickupDate(), saved.getReturnDate());
                return toDetail(saved, null);
            } catch (DataIntegrityViolationException ex) {
                log.warn("Booking reference collision on attempt {} for vehicle {}: {}",
                    attempt + 1, vehicle.getId(), ex.getMostSpecificCause().getMessage());
                if (attempt == 4) throw ex;
            }
        }
        throw new IllegalStateException("Unreachable: retry loop exhausted");
    }

    @Transactional(readOnly = true)
    public PricingBreakdown quote(PriceQuoteRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.vehicleId())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle", request.vehicleId()));
        return pricingService.quote(vehicle, request.pickupDate(), request.returnDate());
    }

    private LocalDate currentRentalEnd(Long vehicleId) {
        return bookingRepository.findByVehicleIdWithVehicle(vehicleId).stream()
            .filter(b -> b.getStatus() == BookingStatus.ACTIVE)
            .map(Booking::getReturnDate)
            .max(Comparator.naturalOrder())
            .orElse(null);
    }

    private void assertNoOverlap(Long vehicleId, LocalDate pickupDate, LocalDate returnDate, Long excludedBookingId) {
        long conflicts = bookingRepository.countOverlapping(vehicleId, pickupDate, returnDate, excludedBookingId);
        if (conflicts > 0) {
            throw BookingConflictException.forWindow(vehicleId, pickupDate, returnDate);
        }
    }

    // ------------------------------------------------------------------- reads

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> myBookings(Long userId, Pageable pageable) {
        Page<Booking> page = bookingRepository.findByUserIdOrderByPickupDateDesc(userId, pageable);
        return PageResponse.of(page, booking -> bookingMapper.toResponse(booking, paymentStatusOf(booking), reviewed(booking)));
    }

    @Transactional(readOnly = true)
    public BookingDetailResponse detail(Long bookingId, UserPrincipal principal) {
        Booking booking = requireAccessibleBooking(bookingId, principal);
        return toDetail(booking, principal);
    }

    @Transactional(readOnly = true)
    public BookingDetailResponse detailByReference(String reference, UserPrincipal principal) {
        Booking booking = bookingRepository.findByReferenceWithDetails(reference)
            .orElseThrow(() -> new ResourceNotFoundException("Booking " + reference + " was not found."));
        assertCanView(booking, principal);
        return toDetail(booking, principal);
    }

    /**
     * Fleet-owner listing. Scoped to {@code principal.getId()} for both
     * FLEET_MANAGER and ADMIN — the fleet console is the owner's own fleet,
     * regardless of role. Global reporting lives in {@code /api/v1/admin}.
     */
    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> fleetBookings(UserPrincipal principal, BookingStatus status, Pageable pageable) {
        fleetAccessGuard.requireFleetOwner(principal);

        Page<Booking> page = status == null
            ? bookingRepository.findByOwnerFleetId(principal.getId(), pageable)
            : bookingRepository.findByOwnerFleetIdAndStatus(principal.getId(), status, pageable);
        return PageResponse.of(page, b -> bookingMapper.toResponse(b, paymentStatusOf(b), reviewed(b)));
    }

    private void assertCanView(Booking booking, UserPrincipal principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication is required to view this booking.");
        }
        boolean owner = booking.getUser().getId().equals(principal.getId());
        if (!owner && !principal.getRole().isStaff()) {
            throw new ResourceNotFoundException("Booking " + booking.getId() + " was not found.");
        }
    }

    /**
     * Loads a booking, enforcing that the caller may touch it.
     *
     * <ul>
     *   <li>ADMIN — any booking.</li>
     *   <li>FLEET_MANAGER — only bookings whose ownerFleet matches them.</li>
     *   <li>CUSTOMER — only bookings they own.</li>
     * </ul>
     *
     * Returns 404 for cross-fleet and cross-customer access so IDs cannot be
     * probed.
     */
    private Booking requireAccessibleBooking(Long bookingId, UserPrincipal principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication is required.");
        }
        return switch (principal.getRole()) {
            case ADMIN -> bookingRepository.findDetailById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
            case FLEET_MANAGER -> bookingRepository.findByIdAndOwnerFleet(bookingId, principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
            case CUSTOMER -> {
                Booking booking = bookingRepository.findDetailById(bookingId)
                    .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
                assertCanView(booking, principal);
                yield booking;
            }
        };
    }

    // -------------------------------------------------------------- lifecycle

    @Transactional
    public BookingDetailResponse cancel(Long bookingId, UserPrincipal principal, String reason) {
        Booking booking = requireAccessibleBooking(bookingId, principal);

        boolean owner = booking.getUser().getId().equals(principal.getId());
        if (!owner && principal.getRole() != Role.ADMIN) {
            throw new InsufficientPermissionException("You can only cancel your own bookings.");
        }
        if (!booking.getStatus().isCancellable()) {
            throw InvalidBookingStateException.transition(booking.getStatus(), BookingStatus.CANCELLED);
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());
        booking.setCancelledBy(principal.getId());
        booking.setCancellationReason(reason);
        bookingRepository.save(booking);

        // Cancellation refund: full amount paid minus the flat ₹200 fee.
        paymentRepository.findByBookingIdAndStatus(bookingId, PaymentStatus.SUCCESS).stream().findFirst()
            .ifPresent(payment -> refundService.refundOnCancellation(payment, "Cancellation: " + reason));

        notificationService.onBookingCancelled(booking, reason);
        auditService.record(AuditAction.BOOKING_CANCELLED, "Booking", booking.getId(),
            "Booking " + booking.getBookingReference() + " cancelled by " + principal.getRole(),
            "reason=" + reason);
        log.info("Booking {} cancelled by user {}", booking.getBookingReference(), principal.getId());
        return toDetail(booking, principal);
    }

    @Transactional
    public Booking confirmAfterPayment(Booking booking) {
        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return booking;
        }
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw InvalidBookingStateException.transition(booking.getStatus(), BookingStatus.CONFIRMED);
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        return bookingRepository.save(booking);
    }

    @Transactional
    public BookingDetailResponse updateStatus(Long bookingId, BookingStatusUpdateRequest request, UserPrincipal principal) {
        Booking booking = requireAccessibleBooking(bookingId, principal);
        BookingStatus target = request.status();

        if (booking.getStatus() == target) {
            return toDetail(booking, principal);
        }
        if (!booking.getStatus().canTransitionTo(target)) {
            throw InvalidBookingStateException.transition(booking.getStatus(), target);
        }

        Vehicle vehicle = vehicleRepository.findByIdForUpdate(booking.getVehicle().getId())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle", booking.getVehicle().getId()));

        switch (target) {
            case CONFIRMED -> booking.setStatus(BookingStatus.CONFIRMED);
            case ACTIVE -> startRental(booking, vehicle, request);
            case COMPLETED -> completeRental(booking, vehicle, request);
            case CANCELLED -> {
                return cancel(bookingId, principal, request.note() == null ? "Cancelled by operations" : request.note());
            }
            default -> throw InvalidBookingStateException.transition(booking.getStatus(), target);
        }

        bookingRepository.save(booking);
        auditService.record(AuditAction.BOOKING_STATUS_CHANGED, "Booking", booking.getId(),
            "Booking " + booking.getBookingReference() + " moved to " + target,
            "by=" + principal.getRole() + (request.note() == null ? "" : ", note=" + request.note()));
        return toDetail(booking, principal);
    }

    private void startRental(Booking booking, Vehicle vehicle, BookingStatusUpdateRequest request) {
        if (vehicle.getStatus() == VehicleStatus.RETIRED || vehicle.getStatus() == VehicleStatus.MAINTENANCE) {
            throw new VehicleUnavailableException(
                "Vehicle is " + vehicle.getStatus() + " and cannot be handed over.");
        }
        if (!vehicle.getStatus().canTransitionTo(VehicleStatus.RENTED)) {
            throw new VehicleUnavailableException(
                "Vehicle status " + vehicle.getStatus() + " cannot move to RENTED.");
        }
        vehicle.setStatus(VehicleStatus.RENTED);
        vehicleRepository.save(vehicle);

        booking.setStatus(BookingStatus.ACTIVE);
        booking.setActualPickupDate(LocalDateTime.now());
        if (request.mileage() != null) {
            booking.setMileageOut(request.mileage());
            vehicle.setMileage(request.mileage());
        }
        notificationService.onBookingActive(booking);
    }

    private void completeRental(Booking booking, Vehicle vehicle, BookingStatusUpdateRequest request) {
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setActualReturnDate(LocalDateTime.now());
        if (request.mileage() != null) {
            booking.setMileageIn(request.mileage());
            vehicle.setMileage(request.mileage());
        }
        if (!vehicle.getStatus().canTransitionTo(VehicleStatus.AVAILABLE)) {
            throw new VehicleUnavailableException(
                "Vehicle status " + vehicle.getStatus() + " cannot move to AVAILABLE.");
        }
        vehicle.setStatus(VehicleStatus.AVAILABLE);
        vehicleRepository.save(vehicle);

        // Booking is now COMPLETED. Refund handling is best-effort:
        // a failed refund MUST NOT roll back the completion, otherwise the
        // customer can never see the "Write a review" button and the vehicle
        // is stuck off the road.
        boolean hasSevereDamage = damageRepository
            .findByBookingIdAndSeverityIn(
                booking.getId(),
                List.of(DamageSeverity.MAJOR, DamageSeverity.CRITICAL))
            .stream().findAny().isPresent();

        if (!hasSevereDamage) {
            paymentRepository.findByBookingIdAndStatus(booking.getId(), PaymentStatus.SUCCESS)
                .stream().findFirst()
                .ifPresent(payment -> {
                    BigDecimal deposit = booking.getDepositAmount();
                    if (deposit != null && deposit.compareTo(BigDecimal.ZERO) > 0) {
                        try {
                            refundService.issueSystemRefund(
                                payment.getId(),
                                deposit,
                                "Deposit refund on return — booking " + booking.getBookingReference(),
                                RefundSource.RETURN);
                            notificationService.notifyUser(
                                booking.getUser().getId(),
                                NotificationType.REFUND_ISSUED,
                                "Deposit refunded — " + booking.getBookingReference(),
                                "Your deposit of ₹" + deposit.toPlainString()
                                    + " has been returned to your original payment method.",
                                "/payments");
                        } catch (Exception ex) {
                            // Log and continue. The fleet can manually refund
                            // via POST /fleet/bookings/{id}/refund-deposit.
                            log.warn("Automatic deposit refund failed for booking {}: {}",
                                booking.getBookingReference(), ex.getMessage());
                        }
                    }
                });
        } else {
            log.info("Deposit for booking {} withheld pending damage assessment",
                booking.getBookingReference());
            notificationService.notifyUser(
                booking.getUser().getId(),
                NotificationType.ACCOUNT_STATUS,
                "Deposit held pending damage review",
                "Your rental has ended. Because damage was logged against this trip, "
                    + "the deposit will be released after the fleet team assesses the repair.",
                "/bookings/" + booking.getBookingReference());
        }

        notificationService.onBookingCompleted(booking);
    }

    // -------------------------------------------------------------- admin view

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> search(BookingStatus status, LocalDate startDate, LocalDate endDate,
                                                Long vehicleId, Long userId, String search, Pageable pageable) {
        Specification<Booking> spec = Specification.allOf(
            BookingSpecifications.hasStatus(status),
            BookingSpecifications.fromDate(startDate),
            BookingSpecifications.toDate(endDate),
            BookingSpecifications.forVehicle(vehicleId),
            BookingSpecifications.forUser(userId),
            BookingSpecifications.referenceOrCustomer(search));
        return PageResponse.of(bookingRepository.findAll(spec, pageable),
            booking -> bookingMapper.toResponse(booking, paymentStatusOf(booking), reviewed(booking)));
    }

    // ---------------------------------------------------------------- mapping

    @Transactional(readOnly = true)
    public BookingDetailResponse toDetail(Booking booking, UserPrincipal principal) {
        return buildDetail(booking, principal != null && principal.getRole().isStaff());
    }

    private BookingDetailResponse buildDetail(Booking booking, boolean staffView) {
        List<Payment> payments = paymentRepository.findByBookingId(booking.getId());
        BigDecimal paid = payments.stream()
            .filter(p -> p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.REFUNDED)
            .map(Payment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = refundService.refundedTotalForBooking(booking.getId());
        PaymentStatus paymentStatus = paymentStatusOf(booking);
        Optional<Review> review = reviewRepository.findByBookingId(booking.getId());

        List<PaymentResponse> paymentResponses = payments.stream()
            .map(p -> paymentMapper.toResponse(p, refundService.refundedTotal(p.getId())))
            .toList();

        return new BookingDetailResponse(
            booking.getId(),
            booking.getBookingReference(),
            booking.getStatus(),
            vehicleMapper.toSummary(booking.getVehicle()),
            bookingMapper.toCustomerSummary(booking),
            booking.getPickupDate(),
            booking.getReturnDate(),
            booking.getPickupLocation(),
            booking.getReturnLocation(),
            booking.getTotalDays(),
            booking.getDailyRate(),
            booking.getBaseAmount(),
            booking.getDepositAmount(),
            booking.getTotalAmount(),
            PricingService.money(paid),
            refunded,
            paymentStatus,
            booking.getNotes(),
            booking.getActualPickupDate(),
            booking.getActualReturnDate(),
            booking.getMileageOut(),
            booking.getMileageIn(),
            booking.getCancelledAt(),
            booking.getCancellationReason(),
            paymentResponses,
            review.map(r -> staffView ? reviewMapper.toOwnerResponse(r) : reviewMapper.toPublicResponse(r)).orElse(null),
            history(booking),
            booking.getCreatedAt(),
            booking.getUpdatedAt());
    }

    private List<BookingDetailResponse.StatusHistoryEntry> history(Booking booking) {
        List<BookingDetailResponse.StatusHistoryEntry> entries = new ArrayList<>();
        BookingStatus current = booking.getStatus();
        if (current == BookingStatus.CANCELLED) {
            entries.add(new BookingDetailResponse.StatusHistoryEntry("PENDING", "Reservation created",
                booking.getCreatedAt(), true));
            entries.add(new BookingDetailResponse.StatusHistoryEntry("CANCELLED", "Cancelled",
                booking.getCancelledAt(), true));
            return entries;
        }
        entries.add(new BookingDetailResponse.StatusHistoryEntry("PENDING", "Reservation created",
            booking.getCreatedAt(), true));
        entries.add(new BookingDetailResponse.StatusHistoryEntry("CONFIRMED", "Payment received",
            current == BookingStatus.PENDING ? null : confirmedAt(booking), current != BookingStatus.PENDING));
        entries.add(new BookingDetailResponse.StatusHistoryEntry("ACTIVE", "Vehicle picked up",
            booking.getActualPickupDate(), booking.getActualPickupDate() != null));
        entries.add(new BookingDetailResponse.StatusHistoryEntry("COMPLETED", "Vehicle returned",
            booking.getActualReturnDate(), booking.getActualReturnDate() != null));
        return entries;
    }

    private LocalDateTime confirmedAt(Booking booking) {
        return paymentRepository.findByBookingIdAndStatus(booking.getId(), PaymentStatus.SUCCESS).stream()
            .map(Payment::getPaidAt)
            .filter(java.util.Objects::nonNull)
            .findFirst()
            .orElse(booking.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public PaymentStatus paymentStatusOf(Booking booking) {
        List<Payment> payments = paymentRepository.findByBookingId(booking.getId());
        if (payments.isEmpty()) return null;
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS)) return PaymentStatus.SUCCESS;
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.REFUNDED)) return PaymentStatus.REFUNDED;
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.PENDING)) return PaymentStatus.PENDING;
        return PaymentStatus.FAILED;
    }

    @Transactional(readOnly = true)
    public boolean reviewed(Booking booking) {
        return reviewRepository.existsByBookingId(booking.getId());
    }

    @Transactional(readOnly = true)
    public long countByStatus(BookingStatus status) {
        return bookingRepository.countByStatus(status);
    }

    @Transactional(readOnly = true)
    public long countForUser(Long userId, BookingStatus status) {
        return bookingRepository.countByUserIdAndStatus(userId, status);
    }

    @Transactional(readOnly = true)
    public List<Booking> upcoming(LocalDate from, int limit) {
        return bookingRepository.findUpcomingWithVehicle(from,
            org.springframework.data.domain.PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<Booking> recent(int limit) {
        return bookingRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, limit,
                    org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")))
            .getContent();
    }

    public int rentalDays(LocalDate pickupDate, LocalDate returnDate) {
        return DateUtils.rentalDays(pickupDate, returnDate);
    }
}

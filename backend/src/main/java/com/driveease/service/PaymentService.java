package com.driveease.service;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.payment.*;
import com.driveease.dto.report.FleetPaymentSummary;
import com.driveease.entity.*;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.PaymentException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.mapper.PaymentMapper;
import com.driveease.repository.BookingRepository;
import com.driveease.repository.PaymentRepository;
import com.driveease.repository.UserRepository;
import com.driveease.repository.spec.PaymentSpecifications;
import com.driveease.security.UserPrincipal;
import com.driveease.util.ReferenceGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Payment workflow (PRD EPIC-04). No real money is moved: the sandbox gateway
 * simulates provider responses and the platform stores only its own references
 * plus, optionally, a card's last four digits.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final BookingService bookingService;
    private final RefundService refundService;
    private final PaymentGateway paymentGateway;
    private final ReferenceGenerator referenceGenerator;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final PaymentMapper paymentMapper;
    private final FleetAccessGuard fleetAccessGuard;

    public PaymentService(PaymentRepository paymentRepository,
                          BookingRepository bookingRepository,
                          UserRepository userRepository,
                          BookingService bookingService,
                          RefundService refundService,
                          PaymentGateway paymentGateway,
                          ReferenceGenerator referenceGenerator,
                          NotificationService notificationService,
                          AuditService auditService,
                          PaymentMapper paymentMapper,
                          FleetAccessGuard fleetAccessGuard) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.bookingService = bookingService;
        this.refundService = refundService;
        this.paymentGateway = paymentGateway;
        this.referenceGenerator = referenceGenerator;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.paymentMapper = paymentMapper;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    @Transactional
    public PaymentResponse pay(Long userId, PaymentCreateRequest request) {
        Booking booking = bookingRepository.findDetailById(request.bookingId())
            .orElseThrow(() -> new ResourceNotFoundException("Booking", request.bookingId()));

        if (!booking.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking " + request.bookingId() + " was not found.");
        }
        switch (booking.getStatus()) {
            case CANCELLED -> throw new PaymentException("BOOKING_CANCELLED",
                "Booking " + booking.getBookingReference() + " was cancelled and cannot be paid.",
                org.springframework.http.HttpStatus.CONFLICT);
            case CONFIRMED, ACTIVE, COMPLETED -> throw PaymentException.alreadyPaid(booking.getBookingReference());
            case PENDING -> { /* payable */ }
        }

        BigDecimal amount = request.amount() == null ? booking.getTotalAmount() : PricingService.money(request.amount());
        if (amount.compareTo(booking.getTotalAmount()) != 0) {
            throw InvalidRequestException.unprocessable("AMOUNT_MISMATCH",
                "Payment amount " + amount + " does not match the booking total of " + booking.getTotalAmount() + ".");
        }

        Payment payment = new Payment();
        payment.setPaymentReference(referenceGenerator.paymentReference(LocalDate.now()));
        payment.setBooking(booking);
        payment.setUser(booking.getUser());
        payment.setAmount(amount);
        payment.setCurrency("INR");
        payment.setPaymentMethod(request.paymentMethod());
        payment.setCardLast4(normaliseCardLast4(request));
        payment.setStatus(PaymentStatus.PENDING);

        PaymentGateway.GatewayResult result = paymentGateway.charge(new PaymentGateway.GatewayCharge(
            booking.getBookingReference(),
            amount,
            payment.getCurrency(),
            request.paymentMethod(),
            request.cardLast4(),
            request.upiId(),
            request.idempotencyKey()));

        payment.setTransactionRef(result.transactionRef());
        if (result.success()) {
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaidAt(LocalDateTime.now());
        } else {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(truncate(result.message(), 255));
        }
        Payment saved = paymentRepository.save(payment);

        if (result.success()) {
            bookingService.confirmAfterPayment(booking);
            notificationService.onPaymentReceived(saved);
            notificationService.onBookingConfirmed(booking, booking.getTotalAmount().toPlainString());
            log.info("Payment {} captured {} for booking {}",
                saved.getPaymentReference(), amount, booking.getBookingReference());
        } else {
            notificationService.onPaymentFailed(saved);
            log.info("Payment {} declined for booking {}: {}",
                saved.getPaymentReference(), booking.getBookingReference(), result.message());
        }
        return paymentMapper.toResponse(saved, BigDecimal.ZERO);
    }

    private String normaliseCardLast4(PaymentCreateRequest request) {
        if (request.cardLast4() != null && !request.cardLast4().isBlank()) {
            return request.cardLast4();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> myPayments(Long userId, Pageable pageable) {
        return PageResponse.of(paymentRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable),
            payment -> paymentMapper.toResponse(payment, refundService.refundedTotal(payment.getId())));
    }

    /**
     * Fleet-owner payment history. Scoped to the caller's own fleet for both
     * FLEET_MANAGER and ADMIN. Global payments live in {@code /api/v1/payments/admin/all}.
     */
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> fleetPayments(UserPrincipal principal, Pageable pageable) {
        fleetAccessGuard.requireFleetOwner(principal);
        return PageResponse.of(
            paymentRepository.findByFleetOwnerIdOrderByCreatedAtDesc(principal.getId(), pageable),
            payment -> paymentMapper.toResponse(payment, refundService.refundedTotal(payment.getId())));
    }

    /**
     * Aggregated earnings for the caller's own fleet.
     */
    @Transactional(readOnly = true)
    public FleetPaymentSummary fleetSummary(UserPrincipal principal) {
        fleetAccessGuard.requireFleetOwner(principal);
        Long ownerId = principal.getId();
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("User", ownerId));

        BigDecimal gross = nz(paymentRepository.sumCollectedForOwner(ownerId));
        BigDecimal refunded = nz(paymentRepository.sumRefundedForOwner(ownerId));
        BigDecimal net = gross.subtract(refunded);
        BigDecimal completed = nz(bookingRepository.sumCompletedRentalRevenueForOwner(ownerId));
        BigDecimal active = nz(bookingRepository.sumActiveRentalRevenueForOwner(ownerId));
        long totalPayments = paymentRepository
            .findByFleetOwnerIdOrderByCreatedAtDesc(ownerId, Pageable.unpaged())
            .getTotalElements();
        long completedBookings = bookingRepository.countCompletedForOwner(ownerId);

        return new FleetPaymentSummary(
            ownerId, owner.fullName(), owner.getEmail(),
            totalPayments, gross, refunded, net, completed, active, completedBookings);
    }

    @Transactional(readOnly = true)
    public PaymentDetailResponse detail(Long paymentId, UserPrincipal principal) {
        Payment payment = paymentRepository.findDetailById(paymentId)
            .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        boolean owner = payment.getUser().getId().equals(principal.getId());
        boolean fleetOwns = payment.getBooking().getOwnerFleet() != null
            && payment.getBooking().getOwnerFleet().getId().equals(principal.getId());
        if (!owner && !fleetOwns && !principal.getRole().isAdmin()) {
            throw new ResourceNotFoundException("Payment " + paymentId + " was not found.");
        }
        BigDecimal refunded = refundService.refundedTotal(paymentId);
        return new PaymentDetailResponse(
            payment.getId(),
            payment.getPaymentReference(),
            payment.getTransactionRef(),
            payment.getAmount(),
            refunded,
            PricingService.money(payment.getAmount().subtract(refunded)),
            payment.getCurrency(),
            payment.getPaymentMethod().name(),
            payment.getStatus().name(),
            payment.getCardLast4(),
            payment.getPaidAt(),
            receipt(payment),
            refundService.listForPayment(paymentId));
    }

    private PaymentDetailResponse.Receipt receipt(Payment payment) {
        Booking booking = payment.getBooking();
        return new PaymentDetailResponse.Receipt(
            "RCPT-" + payment.getPaymentReference(),
            booking.getUser().fullName(),
            booking.getUser().getEmail(),
            booking.getBookingReference(),
            booking.getVehicle().displayName(),
            booking.getVehicle().getLicensePlate(),
            booking.getPickupLocation(),
            booking.getReturnLocation(),
            booking.getPickupDate(),
            booking.getReturnDate(),
            booking.getTotalDays(),
            booking.getBaseAmount(),
            booking.getDepositAmount(),
            booking.getTotalAmount(),
            payment.getPaidAt() == null ? payment.getCreatedAt() : payment.getPaidAt());
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> search(PaymentStatus status, String reference, LocalDateTime from,
                                                LocalDateTime to, Pageable pageable) {
        Specification<Payment> spec = Specification.allOf(
            PaymentSpecifications.hasStatus(status),
            PaymentSpecifications.reference(reference),
            PaymentSpecifications.createdBetween(from, to));
        return PageResponse.of(paymentRepository.findAll(spec, pageable),
            payment -> paymentMapper.toResponse(payment, refundService.refundedTotal(payment.getId())));
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> forBooking(Long bookingId) {
        return paymentRepository.findByBookingId(bookingId).stream()
            .map(payment -> paymentMapper.toResponse(payment, refundService.refundedTotal(payment.getId())))
            .toList();
    }

    @Transactional
    public RefundResponse refund(Long paymentId, RefundRequest request) {
        RefundResponse response = refundService.refundPayment(paymentId, request.amount(), request.reason());
        log.info("Administrative refund {} processed for payment {}", response.refundReference(), paymentId);
        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<RefundResponse> refunds(Pageable pageable) {
        return refundService.listAll(pageable);
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}

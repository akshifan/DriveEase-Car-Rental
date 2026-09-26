package com.driveease.service;

import com.driveease.entity.*;
import com.driveease.exception.InsufficientPermissionException;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.payment.RefundResponse;
import com.driveease.mapper.PaymentMapper;
import com.driveease.repository.PaymentRepository;
import com.driveease.repository.RefundRepository;
import com.driveease.repository.UserRepository;
import com.driveease.security.SecurityUtils;
import com.driveease.security.UserPrincipal;
import com.driveease.util.ReferenceGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Refund ledger.
 *
 * <p>Invariants enforced here:</p>
 * <ul>
 *   <li>a refund can never exceed the amount actually collected;</li>
 *   <li>cumulative refunds can never exceed the original payment;</li>
 *   <li>partial refunds are supported, and a payment is marked REFUNDED only
 *       once the full amount has been returned;</li>
 *   <li>only an ADMIN may issue an administrative refund (from the admin console);</li>
 *   <li>only the owning fleet (FLEET_MANAGER or ADMIN-as-fleet-owner) may issue a
 *       deposit refund for its own booking;</li>
 *   <li><strong>idempotency</strong>: for CANCELLATION and RETURN refunds, at most one
 *       SUCCESS row may exist per (payment, source). Enforced both in the service
 *       (pre-check) and at the database level (partial unique index
 *       {@code uq_refunds_payment_source_success}).</li>
 * </ul>
 */
@Service
public class RefundService {

    private static final Logger log = LoggerFactory.getLogger(RefundService.class);

    private final PricingService pricingService;
    private final RefundRepository refundRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final PaymentGateway paymentGateway;
    private final ReferenceGenerator referenceGenerator;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final PaymentMapper paymentMapper;
    private final FleetAccessGuard fleetAccessGuard;

    public RefundService(PricingService pricingService,
                         RefundRepository refundRepository,
                         PaymentRepository paymentRepository,
                         UserRepository userRepository,
                         PaymentGateway paymentGateway,
                         ReferenceGenerator referenceGenerator,
                         NotificationService notificationService,
                         AuditService auditService,
                         PaymentMapper paymentMapper,
                         FleetAccessGuard fleetAccessGuard) {
        this.pricingService = pricingService;
        this.refundRepository = refundRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.paymentGateway = paymentGateway;
        this.referenceGenerator = referenceGenerator;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.paymentMapper = paymentMapper;
        this.fleetAccessGuard = fleetAccessGuard;
    }

    @Transactional(readOnly = true)
    public BigDecimal refundedTotal(Long paymentId) {
        return refundRepository.sumRefundedForPayment(paymentId);
    }

    @Transactional(readOnly = true)
    public BigDecimal refundedTotalForBooking(Long bookingId) {
        return refundRepository.sumRefundedForBooking(bookingId);
    }

    @Transactional(readOnly = true)
    public BigDecimal remainingRefundable(Payment payment) {
        BigDecimal refunded = refundedTotal(payment.getId());
        return PricingService.money(payment.getAmount().subtract(refunded)).max(BigDecimal.ZERO);
    }

    /** Administrative refund: only an administrator may call this. */
    @Transactional
    public RefundResponse refundPayment(Long paymentId, BigDecimal requestedAmount, String reason) {
        if (!SecurityUtils.isAdmin()) {
            throw new InsufficientPermissionException("Only an administrator can issue an administrative refund.");
        }
        Payment payment = paymentRepository.findDetailById(paymentId)
            .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        if (!payment.getStatus().isCollectable() && payment.getStatus() != PaymentStatus.REFUNDED) {
            throw InvalidRequestException.unprocessable("PAYMENT_NOT_REFUNDABLE",
                "Only a successful payment can be refunded (current status: " + payment.getStatus() + ").");
        }
        BigDecimal amount = requestedAmount == null ? remainingRefundable(payment) : PricingService.money(requestedAmount);
        Refund refund = issueIdempotent(payment, amount, reason, RefundSource.ADMIN, SecurityUtils.currentUserId());
        auditService.record(AuditAction.PAYMENT_REFUNDED, "Payment", payment.getId(),
            "Refund of " + amount + " issued for booking " + payment.getBooking().getBookingReference(),
            "reason=" + reason + ", paymentStatus=" + payment.getStatus());
        return paymentMapper.toResponse(refund, actorName(refund.getProcessedBy()));
    }

    /**
     * Owning-fleet deposit refund.
     *
     * <p>The fleet that owns the vehicle and its booking can issue a partial or
     * full refund of the refundable deposit after the rental is completed.
     * Typical use: a small deduction for documented damage; the rest goes back
     * to the customer.</p>
     *
     * <p>Capped at the booking's original refundable deposit minus whatever has
     * already been refunded. A duplicate full refund attempt returns the existing
     * refund — it never creates a second one.</p>
     */
    @Transactional
    public RefundResponse refundDepositByFleet(Long bookingId, BigDecimal requestedAmount,
                                               String reason, UserPrincipal principal) {
        fleetAccessGuard.requireFleetOwner(principal);

        Payment payment = paymentRepository.findByBookingId(bookingId).stream().findFirst()
            .orElseThrow(() -> new ResourceNotFoundException(
                "No payment recorded for booking " + bookingId));
        Booking booking = payment.getBooking();

        // Ownership check: only the owner of this fleet (fleet manager or admin
        // acting as fleet owner) may refund the deposit.
        boolean isOwner = booking.getOwnerFleet() != null
            && booking.getOwnerFleet().getId().equals(principal.getId());
        if (!isOwner) {
            throw new ResourceNotFoundException("Booking " + bookingId + " was not found.");
        }

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw InvalidRequestException.unprocessable("BOOKING_NOT_COMPLETED",
                "The deposit can only be refunded after the rental is completed.");
        }

        BigDecimal alreadyRefunded = refundedTotal(payment.getId());
        BigDecimal deposit = PricingService.money(booking.getDepositAmount());
        BigDecimal depositRemaining = PricingService.money(deposit.subtract(alreadyRefunded));

        BigDecimal amount = requestedAmount == null ? depositRemaining : PricingService.money(requestedAmount);

        if (depositRemaining.compareTo(BigDecimal.ZERO) <= 0) {
            Refund existing = refundRepository
                .findFirstByPaymentIdAndSourceAndStatus(payment.getId(), RefundSource.RETURN, RefundStatus.SUCCESS)
                .orElseThrow(() -> InvalidRequestException.unprocessable("DEPOSIT_ALREADY_REFUNDED",
                    "The deposit has already been fully refunded."));
            return paymentMapper.toResponse(existing, "Fleet manager");
        }

        if (amount.compareTo(depositRemaining) > 0) {
            throw InvalidRequestException.unprocessable("REFUND_EXCEEDS_DEPOSIT",
                "Refund of " + amount + " exceeds the remaining deposit of " + depositRemaining + ".");
        }

        Refund refund = issue(payment, amount, reason, RefundSource.RETURN, principal.getId());
        notificationService.onRefundIssued(refund, amount);
        auditService.record(AuditAction.PAYMENT_REFUNDED, "Booking", bookingId,
            "Fleet refunded " + amount + " of the deposit for " + booking.getBookingReference(),
            "reason=" + reason);
        return paymentMapper.toResponse(refund, actorName(principal.getId()));
    }

    /** Automatic refund triggered by a customer cancellation. Idempotent. */
    @Transactional
    public Refund refundOnCancellation(Payment payment, String reason) {
        Optional<Refund> existing = refundRepository
            .findFirstByPaymentIdAndSourceAndStatus(payment.getId(), RefundSource.CANCELLATION, RefundStatus.SUCCESS);
        if (existing.isPresent()) {
            log.info("Cancellation refund {} already exists for payment {}; skipping",
                existing.get().getRefundReference(), payment.getId());
            return existing.get();
        }

        BigDecimal refundable = PricingService.money(payment.getAmount()
            .subtract(refundedTotal(payment.getId())));
        if (refundable.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        // Cancellation policy: flat ₹200 fee, everything else (rental + deposit) refunded.
        int daysUntilPickup = (int) java.time.temporal.ChronoUnit.DAYS.between(
            LocalDate.now(), payment.getBooking().getPickupDate());
        BigDecimal amount = pricingService.refundableAmount(payment.getAmount(),
            refundedTotal(payment.getId()), payment.getBooking().getDailyRate(), daysUntilPickup);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        Refund refund = issueIdempotent(payment, amount, reason, RefundSource.CANCELLATION, null);
        notificationService.onRefundIssued(refund, amount);
        return refund;
    }

    /**
     * Internal refund path used by automated flows. Idempotent at the service
     * layer (pre-check) AND at the database layer (partial unique index).
     */
    @Transactional
    public RefundResponse issueSystemRefund(Long paymentId, BigDecimal amount, String reason,
                                            RefundSource source) {
        Payment payment = paymentRepository.findDetailById(paymentId)
            .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        Optional<Refund> existing = refundRepository
            .findFirstByPaymentIdAndSourceAndStatus(paymentId, source, RefundStatus.SUCCESS);
        if (existing.isPresent()) {
            log.info("Refund {} already exists for payment {} (source={}); skipping",
                existing.get().getRefundReference(), paymentId, source);
            return paymentMapper.toResponse(existing.get(), "DriveEase system");
        }

        Refund refund = issueIdempotent(payment, amount, reason, source, null);
        return paymentMapper.toResponse(refund, "DriveEase system");
    }

    private Refund issueIdempotent(Payment payment, BigDecimal amount, String reason,
                                   RefundSource source, Long processedBy) {
        try {
            return issue(payment, amount, reason, source, processedBy);
        } catch (DataIntegrityViolationException ex) {
            log.warn("Concurrent {} refund insert for payment {}; returning existing row",
                source, payment.getId());
            return refundRepository
                .findFirstByPaymentIdAndSourceAndStatus(payment.getId(), source, RefundStatus.SUCCESS)
                .orElseThrow(() -> ex);
        }
    }

    private Refund issue(Payment payment, BigDecimal amount, String reason, RefundSource source, Long processedBy) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw InvalidRequestException.unprocessable("INVALID_REFUND_AMOUNT", "A refund amount must be positive.");
        }
        BigDecimal remaining = remainingRefundable(payment);
        if (amount.compareTo(remaining) > 0) {
            throw InvalidRequestException.unprocessable("REFUND_EXCEEDS_PAYMENT",
                "Refund of " + amount + " exceeds the refundable balance of " + remaining + ".");
        }

        GatewayReceipt receipt = GatewayReceipt.referenceOnly(
            paymentGateway.refund(new PaymentGateway.GatewayRefund(
                payment.getTransactionRef(), amount, payment.getCurrency(), reason)));

        Refund refund = new Refund();
        refund.setPayment(payment);
        refund.setBooking(payment.getBooking());
        refund.setAmount(amount);
        refund.setReason(reason);
        refund.setSource(source);
        refund.setProcessedBy(processedBy);
        refund.setStatus(receipt.success() ? RefundStatus.SUCCESS : RefundStatus.FAILED);
        refund.setRefundReference(referenceGenerator.refundReference(LocalDate.now()));
        refundRepository.save(refund);

        if (receipt.success()) {
            BigDecimal totalRefunded = PricingService.money(refundedTotal(payment.getId()).add(amount));
            if (totalRefunded.compareTo(payment.getAmount()) >= 0) {
                payment.setStatus(PaymentStatus.REFUNDED);
            }
            paymentRepository.save(payment);
            log.info("Refund {} issued: {} for payment {} ({})",
                refund.getRefundReference(), amount, payment.getPaymentReference(), source);
        }
        return refund;
    }

    @Transactional(readOnly = true)
    public PageResponse<RefundResponse> listAll(Pageable pageable) {
        return PageResponse.of(refundRepository.findAllByOrderByCreatedAtDesc(pageable), paymentMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public java.util.List<RefundResponse> listForPayment(Long paymentId) {
        return refundRepository.findByPaymentIdOrderByCreatedAtDesc(paymentId).stream()
            .map(refund -> paymentMapper.toResponse(refund, actorName(refund.getProcessedBy())))
            .toList();
    }

    private String actorName(Long userId) {
        if (userId == null) {
            return "DriveEase system";
        }
        return userRepository.findById(userId).map(User::fullName).orElse("DriveEase system");
    }

    private record GatewayReceipt(boolean success, String reference, String message) {
        static GatewayReceipt referenceOnly(PaymentGateway.GatewayResult result) {
            return new GatewayReceipt(result.success(), result.transactionRef(), result.message());
        }
    }
}

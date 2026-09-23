package com.driveease.service;

import com.driveease.entity.*;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.payment.RefundResponse;
import com.driveease.mapper.PaymentMapper;
import com.driveease.repository.PaymentRepository;
import com.driveease.repository.RefundRepository;
import com.driveease.repository.UserRepository;
import com.driveease.security.SecurityUtils;
import com.driveease.util.ReferenceGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Refund ledger (PRD US-03-04 cancellation refunds, US-04-04 administrative refunds).
 *
 * <p>Invariants enforced here:</p>
 * <ul>
 *   <li>a refund can never exceed the amount actually collected;</li>
 *   <li>cumulative refunds can never exceed the original payment;</li>
 *   <li>partial refunds are supported, and a payment is marked REFUNDED only
 *       once the full amount has been returned;</li>
 *   <li>only an ADMIN may issue an administrative refund - the actor is stored.</li>
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

    public RefundService(PricingService pricingService,
                         RefundRepository refundRepository,
                         PaymentRepository paymentRepository,
                         UserRepository userRepository,
                         PaymentGateway paymentGateway,
                         ReferenceGenerator referenceGenerator,
                         NotificationService notificationService,
                         AuditService auditService,
                         PaymentMapper paymentMapper) {
        this.pricingService = pricingService;
        this.refundRepository = refundRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.paymentGateway = paymentGateway;
        this.referenceGenerator = referenceGenerator;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.paymentMapper = paymentMapper;
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

    /** Administrative refund: authorisation is enforced in the controller and re-checked here. */
    @Transactional
    public RefundResponse refundPayment(Long paymentId, BigDecimal requestedAmount, String reason) {
        if (!SecurityUtils.isAdmin()) {
            throw new com.driveease.exception.InsufficientPermissionException(
                    "Only an administrator can issue a refund.");
        }
        Payment payment = paymentRepository.findDetailById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        if (!payment.getStatus().isCollectable() && payment.getStatus() != PaymentStatus.REFUNDED) {
            throw InvalidRequestException.unprocessable("PAYMENT_NOT_REFUNDABLE",
                    "Only a successful payment can be refunded (current status: " + payment.getStatus() + ").");
        }
        BigDecimal amount = requestedAmount == null ? remainingRefundable(payment) : PricingService.money(requestedAmount);
        Refund refund = issue(payment, amount, reason, RefundSource.ADMIN, SecurityUtils.currentUserId());
        auditService.record(AuditAction.PAYMENT_REFUNDED, "Payment", payment.getId(),
                "Refund of " + amount + " issued for booking " + payment.getBooking().getBookingReference(),
                "reason=" + reason + ", paymentStatus=" + payment.getStatus());
        return paymentMapper.toResponse(refund, actorName(refund.getProcessedBy()));
    }

    /** Automatic refund triggered by a customer cancellation. */
    @Transactional
    public Refund refundOnCancellation(Payment payment, String reason) {
        BigDecimal refundable = PricingService.money(payment.getAmount()
                .subtract(refundedTotal(payment.getId())));
        if (refundable.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        // Cancellation policy lives in the PricingService: deposit always returned, one day
        // retained when cancelling inside 24 hours of pickup.
        int daysUntilPickup = (int) java.time.temporal.ChronoUnit.DAYS.between(
                LocalDate.now(), payment.getBooking().getPickupDate());
        BigDecimal amount = pricingService.refundableAmount(payment.getAmount(),
                refundedTotal(payment.getId()), payment.getBooking().getDailyRate(), daysUntilPickup);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        Refund refund = issue(payment, amount, reason, RefundSource.CANCELLATION, null);
        notificationService.onRefundIssued(refund, amount);
        return refund;
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

    /** Small internal carrier so the gateway result never leaks into the API layer. */
    private record GatewayReceipt(boolean success, String reference, String message) {
        static GatewayReceipt referenceOnly(PaymentGateway.GatewayResult result) {
            return new GatewayReceipt(result.success(), result.transactionRef(), result.message());
        }
    }
}

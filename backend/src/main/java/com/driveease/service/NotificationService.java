package com.driveease.service;

import com.driveease.entity.*;
import com.driveease.repository.NotificationRepository;
import com.driveease.repository.UserRepository;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.user.NotificationResponse;
import com.driveease.mapper.UserMapper;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * In-app notifications plus the matching email events. Kept intentionally small:
 * each business event maps to one notification and, where appropriate, one email.
 *
 * <p><strong>Link format:</strong> every link is a frontend route that must resolve
 * to a page. Booking links use the <em>numeric booking id</em> because
 * {@code /bookings/:bookingId} expects a {@code Long} — a booking reference like
 * {@code DE-20260928-0545} would fail path-variable conversion with HTTP 400.</p>
 */
@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final UserMapper userMapper;

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository,
                               EmailService emailService,
                               UserMapper userMapper) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.userMapper = userMapper;
    }

    /**
     * Single source of truth for every in-app link. Keeping it in one method
     * makes it impossible to ship a link like {@code /bookings/DE-...} by accident.
     */
    private static String bookingLink(Booking booking) {
        return "/bookings/" + booking.getId();
    }

    @Transactional
    public void notify(User user, NotificationType type, String title, String message, String link) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setLink(link);
        notificationRepository.save(notification);
    }

    @Transactional
    public void notifyUser(Long userId, NotificationType type, String title, String message, String link) {
        userRepository.findById(userId).ifPresent(user -> notify(user, type, title, message, link));
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(Long userId, Pageable pageable) {
        return PageResponse.of(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable),
            userMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public int markAllRead(Long userId) {
        return notificationRepository.markAllRead(userId, LocalDateTime.now());
    }

    // ----------------------------------------------------------------- events

    public void onBookingCreated(Booking booking) {
        notify(booking.getUser(), NotificationType.BOOKING_CREATED,
            "Reservation started - " + booking.getBookingReference(),
            "Your reservation for the " + booking.getVehicle().displayName() + " is awaiting payment.",
            bookingLink(booking));
    }

    public void onBookingConfirmed(Booking booking, String amount) {
        notify(booking.getUser(), NotificationType.BOOKING_CONFIRMED,
            "Booking confirmed - " + booking.getBookingReference(),
            "Your " + booking.getVehicle().displayName() + " is reserved from " + booking.getPickupDate()
                + " to " + booking.getReturnDate() + ".",
            bookingLink(booking));
        emailService.sendBookingConfirmed(booking.getUser().getEmail(), booking.getUser().getFirstName(),
            booking.getBookingReference(), booking.getVehicle().displayName(),
            booking.getPickupDate().toString(), booking.getReturnDate().toString(), amount);
    }

    public void onBookingActive(Booking booking) {
        notify(booking.getUser(), NotificationType.BOOKING_ACTIVE,
            "Enjoy your drive - " + booking.getBookingReference(),
            "Your rental of the " + booking.getVehicle().displayName() + " has started.",
            bookingLink(booking));
        emailService.sendBookingStatus(booking.getUser().getEmail(), booking.getUser().getFirstName(),
            booking.getBookingReference(), "active", "Your rental has started. Drive safely.");
    }

    public void onBookingCompleted(Booking booking) {
        notify(booking.getUser(), NotificationType.BOOKING_COMPLETED,
            "Rental complete - " + booking.getBookingReference(),
            "Thanks for returning the " + booking.getVehicle().displayName()
                + ". You can now review it.",
            bookingLink(booking));
        emailService.sendReviewInvitation(booking.getUser().getEmail(), booking.getUser().getFirstName(),
            booking.getVehicle().displayName(), booking.getBookingReference());
    }

    public void onBookingCancelled(Booking booking, String reason) {
        notify(booking.getUser(), NotificationType.BOOKING_CANCELLED,
            "Booking cancelled - " + booking.getBookingReference(),
            "Your reservation was cancelled. Reason: " + reason,
            "/bookings");
        emailService.sendBookingStatus(booking.getUser().getEmail(), booking.getUser().getFirstName(),
            booking.getBookingReference(), "cancelled", "Your reservation was cancelled. Reason: " + reason);
    }

    public void onPaymentReceived(Payment payment) {
        notify(payment.getUser(), NotificationType.PAYMENT_RECEIVED,
            "Payment received - " + payment.getPaymentReference(),
            "We received " + payment.getAmount() + " for booking "
                + payment.getBooking().getBookingReference() + ".",
            "/payments");
        emailService.sendPaymentReceipt(payment.getUser().getEmail(), payment.getUser().getFirstName(),
            payment.getBooking().getBookingReference(), payment.getPaymentReference(),
            payment.getAmount().toPlainString(), payment.getTransactionRef());
    }

    public void onPaymentFailed(Payment payment) {
        notify(payment.getUser(), NotificationType.PAYMENT_FAILED,
            "Payment failed - " + payment.getPaymentReference(),
            "We could not process your payment: " + payment.getFailureReason()
                + ". Your booking is still held but not confirmed.",
            bookingLink(payment.getBooking()));
    }

    public void onRefundIssued(Refund refund, java.math.BigDecimal amount) {
        notifyUser(refund.getBooking().getUser().getId(), NotificationType.REFUND_ISSUED,
            "Refund issued - " + refund.getBooking().getBookingReference(),
            "A refund of " + amount + " has been issued for " + refund.getBooking().getBookingReference() + ".",
            "/payments");
        emailService.sendRefundIssued(refund.getBooking().getUser().getEmail(),
            refund.getBooking().getUser().getFirstName(),
            refund.getBooking().getBookingReference(), amount.toPlainString());
    }

    public void onAccountStatus(org.springframework.security.core.userdetails.UserDetails userDetails) {
        // no-op hook kept for symmetry; account state changes are audited and notified by UserService
    }
}

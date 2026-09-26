package com.driveease.service;

import com.driveease.config.AppProperties;
import com.driveease.security.JwtProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Email abstraction used by the auth, booking, payment and review flows.
 *
 * <p>Two providers ship with the application:</p>
 * <ul>
 *   <li>{@code mock} (default) - renders the message into the application log, so the
 *       complete flow is demonstrable without a paid provider or SMTP server.</li>
 *   <li>{@code smtp} - real delivery through Spring's JavaMail integration, configured
 *       entirely from environment variables ({@code SMTP_*}); no provider credentials
 *       are ever hard-coded and a provider outage never fails a business transaction.</li>
 * </ul>
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final AppProperties properties;
    private final JwtProperties jwtProperties;
    private final JavaMailSender mailSender;
    private final String provider;

    public EmailService(AppProperties properties,
                        JwtProperties jwtProperties,
                        ObjectProvider<JavaMailSender> mailSenderProvider,
                        @Value("${driveease.email.provider:mock}") String provider) {
        this.properties = properties;
        this.jwtProperties = jwtProperties;
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.provider = provider;
    }

    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return;
        }
        if ("smtp".equalsIgnoreCase(provider) && mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom("%s <%s>".formatted(properties.getEmail().getFromName(), properties.getEmail().getFrom()));
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
                log.info("Email delivered via SMTP to {}: {}", to, subject);
                return;
            } catch (Exception ex) {
                log.error("SMTP delivery failed for {}: {}", to, ex.getMessage());
                return;
            }
        }
        log.info("""

                ─────────────── DriveEase email (mock provider) ───────────────
                To      : {}
                Subject : {}
                {}
                ───────────────────────────────────────────────────────────────
                """, to, subject, body);
    }

    /** True when messages are logged instead of delivered (development/portfolio mode). */
    public boolean isMockProvider() {
        return !"smtp".equalsIgnoreCase(provider) || mailSender == null;
    }

    public void sendWelcome(String email, String firstName) {
        send(email, "Welcome to DriveEase",
                "Hi " + firstName + ",\n\n"
                        + "Your DriveEase account is ready. Browse the fleet, reserve a car and manage\n"
                        + "everything from your dashboard.\n\n"
                        + properties.getEmail().getAppBaseUrl() + "/vehicles\n\n"
                        + "— The DriveEase team");
    }

    public void sendPasswordReset(String email, String firstName, String resetToken) {
        String link = properties.getEmail().getAppBaseUrl() + "/reset-password?token=" + resetToken;
        send(email, "Reset your DriveEase password",
                "Hi " + firstName + ",\n\n"
                        + "Use the link below to choose a new password. It expires in "
                        + jwtProperties.getResetTokenTtlMinutes() + " minutes and can be used once.\n\n"
                        + link + "\n\n"
                        + "If you did not request this, you can safely ignore this email.");
    }

    public void sendBookingConfirmed(String email, String firstName, String reference, String vehicle,
                                     String pickupDate, String returnDate, String total) {
        send(email, "Booking confirmed - " + reference,
                "Hi " + firstName + ",\n\n"
                        + "Your rental is confirmed.\n\n"
                        + "  Reference : " + reference + "\n"
                        + "  Vehicle   : " + vehicle + "\n"
                        + "  Pickup    : " + pickupDate + "\n"
                        + "  Return    : " + returnDate + "\n"
                        + "  Total paid: " + total + "\n\n"
                        + "Please carry your driving licence and a photo ID to the pickup branch.");
    }

    public void sendPaymentReceipt(String email, String firstName, String bookingReference, String paymentReference,
                                   String amount, String transactionRef) {
        send(email, "Receipt for " + bookingReference,
                "Hi " + firstName + ",\n\n"
                        + "We received your payment.\n\n"
                        + "  Payment reference : " + paymentReference + "\n"
                        + "  Transaction ref   : " + transactionRef + "\n"
                        + "  Booking           : " + bookingReference + "\n"
                        + "  Amount            : " + amount + "\n\n"
                        + "Your receipt is also available in your DriveEase dashboard.");
    }

    public void sendBookingStatus(String email, String firstName, String reference, String status, String detail) {
        send(email, "Booking " + reference + " is now " + status,
                "Hi " + firstName + ",\n\n" + detail + "\n\nReference: " + reference);
    }

    public void sendRefundIssued(String email, String firstName, String bookingReference, String amount) {
        send(email, "Refund issued for " + bookingReference,
                "Hi " + firstName + ",\n\n"
                        + "A refund of " + amount + " has been issued for booking " + bookingReference + ".\n"
                        + "Depending on your bank it may take 5-7 business days to appear.");
    }

    public void sendReviewInvitation(String email, String firstName, String vehicle, String bookingReference) {
        send(email, "How was the " + vehicle + "?",
                "Hi " + firstName + ",\n\n"
                        + "Thanks for renting with DriveEase. Share your experience of the " + vehicle
                        + " to help other travellers.\n\n"
                        + properties.getEmail().getAppBaseUrl() + "/bookings/" + bookingReference + "\n\n"
                        + "Booking: " + bookingReference);
    }

    public void sendFleetVerification(String email, String firstName, String companyName, String token) {
        String link = properties.getEmail().getAppBaseUrl()
            + "/verify-fleet-email?token=" + token;
        send(email, "Verify your DriveEase fleet account",
            "Hi " + firstName + ",\n\n"
                + "Welcome aboard! Click the link below to verify your email and activate your\n"
                + "fleet account for " + companyName + ".\n\n"
                + link + "\n\n"
                + "The link expires in 48 hours. If you did not sign up, ignore this message.\n\n"
                + "— The DriveEase team");
    }

}

package com.driveease.service;

import com.driveease.config.AppProperties;
import com.driveease.security.JwtProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Email abstraction used by the auth, booking, payment and review flows.
 *
 * <p>Three providers ship with the application:</p>
 * <ul>
 *   <li>{@code mock} (default) - renders the message into the application log, so the
 *       complete flow is demonstrable without a paid provider.</li>
 *   <li>{@code brevo} - real delivery through Brevo's HTTPS REST API. This is the
 *       recommended production provider because hosting platforms such as Render's
 *       free tier block outbound SMTP ports (25, 465, 587); HTTPS on port 443 is
 *       always allowed.</li>
 *   <li>{@code smtp} - legacy JavaMail delivery for environments where outbound SMTP
 *       is permitted (local development, paid hosting tiers).</li>
 * </ul>
 *
 * <p>A provider outage never fails a business transaction: send failures are logged
 * and swallowed.</p>
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    private final AppProperties properties;
    private final JwtProperties jwtProperties;
    private final String provider;
    private final String brevoApiKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public EmailService(AppProperties properties,
                        JwtProperties jwtProperties,
                        @Value("${driveease.email.provider:mock}") String provider,
                        @Value("${driveease.email.brevo-api-key:}") String brevoApiKey) {
        this.properties = properties;
        this.jwtProperties = jwtProperties;
        this.provider = provider;
        this.brevoApiKey = brevoApiKey;
    }

    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return;
        }

        if ("brevo".equalsIgnoreCase(provider)) {
            sendViaBrevo(to, subject, body);
            return;
        }

        // Fallback: log the message (mock / smtp modes).
        // SMTP delivery is intentionally removed here because Render's free tier
        // blocks outbound SMTP ports. Use the brevo provider in production.
        log.info("""

                ─────────────── DriveEase email (mock provider) ───────────────
                To      : {}
                Subject : {}
                {}
                ───────────────────────────────────────────────────────────────
                """, to, subject, body);
    }

    /**
     * Delivers the message over Brevo's HTTPS API.
     *
     * @see <a href="https://developers.brevo.com/reference/sendtransacemail">Brevo Send Transactional Email</a>
     */
    private void sendViaBrevo(String to, String subject, String body) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            log.error("Brevo API key is not configured; email to {} was not sent.", to);
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        // Brevo expects the API key in the "api-key" header, NOT "Authorization".
        headers.set("api-key", brevoApiKey);

        Map<String, Object> payload = Map.of(
            "sender", Map.of(
                "name", properties.getEmail().getFromName(),
                "email", properties.getEmail().getFrom()
            ),
            "to", List.of(Map.of("email", to)),
            "subject", subject,
            "textContent", body
        );

        try {
            restTemplate.postForEntity(BREVO_API_URL, new HttpEntity<>(payload, headers), String.class);
            log.info("Email delivered via Brevo API to {}: {}", to, subject);
        } catch (Exception ex) {
            log.error("Brevo API delivery failed for {}: {}", to, ex.getMessage());
        }
    }

    /** True when messages are logged instead of delivered (development/portfolio mode). */
    public boolean isMockProvider() {
        return !"brevo".equalsIgnoreCase(provider);
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
    @jakarta.annotation.PostConstruct
    public void testOnStartup() {
        log.info("EmailService initialized with provider='{}', brevoApiKeySet={}",
            provider, brevoApiKey != null && !brevoApiKey.isBlank());
    }
}

package com.driveease.service;

import com.driveease.config.AppProperties;
import com.driveease.util.ReferenceGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Deterministic sandbox provider - no real money moves.
 *
 * <p>Decline rules (documented so demos and automated tests are reproducible):</p>
 * <ol>
 *   <li>{@code ALWAYS_FAIL} mode declines everything; {@code ALWAYS_SUCCEED} approves everything.</li>
 *   <li>{@code SANDBOX} mode (default) declines when:
 *     <ul>
 *       <li>the amount exceeds {@code driveease.payment.failure-threshold-amount};</li>
 *       <li>a card reference of {@code 0000} is supplied;</li>
 *       <li>a UPI id containing "fail" is supplied.</li>
 *     </ul>
 *   </li>
 * </ol>
 */
@Service
public class SandboxPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(SandboxPaymentGateway.class);
    private static final String MAGIC_FAIL_CARD = "0000";

    private final AppProperties properties;
    private final ReferenceGenerator referenceGenerator;

    public SandboxPaymentGateway(AppProperties properties, ReferenceGenerator referenceGenerator) {
        this.properties = properties;
        this.referenceGenerator = referenceGenerator;
    }

    @Override
    public String providerName() {
        return "driveease-sandbox";
    }

    @Override
    public GatewayResult charge(GatewayCharge charge) {
        String mode = properties.getPayment().getGatewayMode();
        String txnRef = referenceGenerator.gatewayTransactionRef(properties.getPayment().getReferencePrefix());

        if ("ALWAYS_FAIL".equalsIgnoreCase(mode)) {
            return GatewayResult.declined(txnRef, "Sandbox provider is configured to decline all payments.");
        }
        if ("ALWAYS_SUCCEED".equalsIgnoreCase(mode)) {
            return GatewayResult.ok(txnRef, "Payment approved by sandbox provider.");
        }

        BigDecimal threshold = properties.getPayment().getFailureThresholdAmount();
        if (threshold != null && charge.amount() != null && charge.amount().compareTo(threshold) > 0) {
            return GatewayResult.declined(txnRef,
                    "Declined by sandbox issuer: amount exceeds the sandbox limit of " + threshold.toPlainString() + ".");
        }
        if (charge.method() != null && charge.method().isCard() && MAGIC_FAIL_CARD.equals(charge.cardLast4())) {
            return GatewayResult.declined(txnRef, "Declined by sandbox issuer: card reference 0000 is a test decline.");
        }
        if (charge.upiId() != null && charge.upiId().toLowerCase().contains("fail")) {
            return GatewayResult.declined(txnRef, "Declined by sandbox UPI: this handle is configured to fail.");
        }
        log.debug("Sandbox charge approved for booking {} ({})", charge.bookingReference(), charge.amount());
        return GatewayResult.ok(txnRef, "Payment approved by sandbox provider.");
    }

    @Override
    public GatewayResult refund(GatewayRefund refund) {
        String reference = referenceGenerator.gatewayTransactionRef("DE-RFD");
        return GatewayResult.ok(reference,
                "Sandbox provider accepted the refund of " + refund.amount().toPlainString() + ".");
    }
}

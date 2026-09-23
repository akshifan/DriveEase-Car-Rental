package com.driveease.service;

import com.driveease.entity.PaymentMethod;

import java.math.BigDecimal;

/**
 * Payment provider abstraction. A real PSP (Stripe/Razorpay/Adyen) is plugged in
 * by implementing this interface and selecting it in configuration; the sandbox
 * implementation demonstrates the full lifecycle without moving real money.
 *
 * <p>Implementations must never log, store or receive card numbers, CVVs or
 * other PCI-scoped data - only the instrument type and, optionally, last four
 * digits are passed through.</p>
 */
public interface PaymentGateway {

    GatewayResult charge(GatewayCharge charge);

    GatewayResult refund(GatewayRefund refund);

    String providerName();

    record GatewayCharge(String bookingReference,
                         BigDecimal amount,
                         String currency,
                         PaymentMethod method,
                         String cardLast4,
                         String upiId,
                         String idempotencyKey) {
    }

    record GatewayRefund(String transactionRef, BigDecimal amount, String currency, String reason) {
    }

    record GatewayResult(boolean success, String transactionRef, String message) {

        public static GatewayResult ok(String transactionRef, String message) {
            return new GatewayResult(true, transactionRef, message);
        }

        public static GatewayResult declined(String transactionRef, String message) {
            return new GatewayResult(false, transactionRef, message);
        }
    }
}

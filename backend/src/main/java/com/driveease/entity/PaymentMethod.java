package com.driveease.entity;

/**
 * Supported payment instruments. CARD is the generic card rail used by the
 * sandbox gateway; CREDIT_CARD / DEBIT_CARD are the explicit variants.
 */
public enum PaymentMethod {
    CARD,
    CREDIT_CARD,
    DEBIT_CARD,
    UPI,
    CASH;

    public boolean isCard() {
        return this == CARD || this == CREDIT_CARD || this == DEBIT_CARD;
    }
}

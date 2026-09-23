package com.driveease.entity;

import java.util.EnumSet;
import java.util.Set;

public enum PaymentStatus {
    PENDING,
    SUCCESS,
    FAILED,
    REFUNDED;

    private static final Set<PaymentStatus> FROM_PENDING = EnumSet.of(SUCCESS, FAILED);

    public boolean canTransitionTo(PaymentStatus target) {
        if (this == target) {
            return true;
        }
        return switch (this) {
            case PENDING -> FROM_PENDING.contains(target);
            case SUCCESS -> target == REFUNDED;
            case FAILED, REFUNDED -> false;
        };
    }

    public boolean isCollectable() {
        return this == SUCCESS;
    }
}

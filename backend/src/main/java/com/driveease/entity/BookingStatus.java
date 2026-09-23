package com.driveease.entity;

import java.util.EnumSet;
import java.util.Set;

/**
 * Booking lifecycle.
 *
 * <pre>
 * PENDING -> CONFIRMED -> ACTIVE -> COMPLETED
 * PENDING -> CANCELLED
 * CONFIRMED -> CANCELLED
 * </pre>
 *
 * COMPLETED and CANCELLED are terminal. The backend is the source of truth for
 * every transition; the frontend may only request them.
 */
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    ACTIVE,
    COMPLETED,
    CANCELLED;

    private static final Set<BookingStatus> FROM_PENDING = EnumSet.of(CONFIRMED, CANCELLED);
    private static final Set<BookingStatus> FROM_CONFIRMED = EnumSet.of(ACTIVE, CANCELLED);
    private static final Set<BookingStatus> FROM_ACTIVE = EnumSet.of(COMPLETED);

    public boolean canTransitionTo(BookingStatus target) {
        if (this == target) {
            return true;
        }
        return switch (this) {
            case PENDING -> FROM_PENDING.contains(target);
            case CONFIRMED -> FROM_CONFIRMED.contains(target);
            case ACTIVE -> FROM_ACTIVE.contains(target);
            case COMPLETED, CANCELLED -> false;
        };
    }

    /** Statuses that hold the vehicle for the requested window (US-02-01). */
    public boolean holdsVehicle() {
        return this == PENDING || this == CONFIRMED || this == ACTIVE;
    }

    public boolean isCancellable() {
        return this == PENDING || this == CONFIRMED;
    }

    public boolean isActiveOrCompleted() {
        return this == ACTIVE || this == COMPLETED;
    }
}

package com.driveease.entity;

import java.util.EnumSet;
import java.util.Set;

/**
 * Vehicle lifecycle. Transition rules are enforced server side (US-02-05):
 * a rented car can never be retired directly and a retired car is terminal.
 */
public enum VehicleStatus {
    AVAILABLE,
    RENTED,
    MAINTENANCE,
    RETIRED;

    private static final Set<VehicleStatus> FROM_AVAILABLE = EnumSet.of(RENTED, MAINTENANCE, RETIRED);
    private static final Set<VehicleStatus> FROM_RENTED = EnumSet.of(AVAILABLE, MAINTENANCE);
    private static final Set<VehicleStatus> FROM_MAINTENANCE = EnumSet.of(AVAILABLE, RETIRED);

    public boolean canTransitionTo(VehicleStatus target) {
        if (this == target) {
            return true;
        }
        return switch (this) {
            case AVAILABLE -> FROM_AVAILABLE.contains(target);
            case RENTED -> FROM_RENTED.contains(target);
            case MAINTENANCE -> FROM_MAINTENANCE.contains(target);
            case RETIRED -> false; // terminal state
        };
    }

    public boolean isBookable() {
        return this == AVAILABLE;
    }
}

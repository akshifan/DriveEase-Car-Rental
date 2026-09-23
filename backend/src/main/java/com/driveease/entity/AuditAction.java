package com.driveease.entity;

/** Enumerated privileged operations written to the audit trail. */
public enum AuditAction {
    USER_ACTIVATED,
    USER_DEACTIVATED,
    USER_REGISTERED,
    VEHICLE_CREATED,
    VEHICLE_UPDATED,
    VEHICLE_RETIRED,
    VEHICLE_STATUS_CHANGED,
    BOOKING_STATUS_CHANGED,
    BOOKING_CANCELLED,
    PAYMENT_REFUNDED,
    REVIEW_REMOVED,
    MAINTENANCE_SCHEDULED,
    DAMAGE_LOGGED
}

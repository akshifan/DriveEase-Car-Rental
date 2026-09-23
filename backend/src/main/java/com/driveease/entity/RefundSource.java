package com.driveease.entity;

public enum RefundSource {
    /** Triggered automatically when a paid booking is cancelled. */
    CANCELLATION,
    /** Issued manually by an administrator (US-04-04). */
    ADMIN
}

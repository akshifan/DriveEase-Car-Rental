package com.driveease.entity;

/**
 * Where a refund originated.
 *
 * <ul>
 *   <li>{@code CANCELLATION} — automatically triggered by a customer cancellation.</li>
 *   <li>{@code RETURN} — automatically triggered when a rental ends cleanly and
 *       the deposit is released.</li>
 *   <li>{@code ADMIN} — manually issued by an administrator.</li>
 * </ul>
 */
public enum RefundSource {
    CANCELLATION,
    RETURN,
    ADMIN
}

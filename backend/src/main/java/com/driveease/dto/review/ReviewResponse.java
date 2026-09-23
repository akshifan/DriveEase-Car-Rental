package com.driveease.dto.review;

import java.time.LocalDateTime;

/**
 * Reviewer PII is limited to a first name and initials (PRD US-06-02).
 * Vehicle and booking context is only populated for the review owner and admins.
 */
public record ReviewResponse(
        Long id,
        Long vehicleId,
        String vehicleName,
        Long bookingId,
        String bookingReference,
        String reviewerName,
        String reviewerInitials,
        Integer rating,
        String title,
        String comment,
        boolean deleted,
        String deleteReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

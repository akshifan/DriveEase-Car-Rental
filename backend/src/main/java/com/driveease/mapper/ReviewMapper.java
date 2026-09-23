package com.driveease.mapper;

import com.driveease.dto.review.ReviewResponse;
import com.driveease.entity.Review;
import org.springframework.stereotype.Component;

@Component
public class ReviewMapper {

    /** Default view: reviewer identity is reduced to a first name and initials. */
    public ReviewResponse toPublicResponse(Review review) {
        if (review == null) {
            return null;
        }
        String firstName = review.getUser().getFirstName();
        return new ReviewResponse(
                review.getId(),
                review.getVehicle().getId(),
                review.getVehicle().displayName(),
                null,
                null,
                firstName,
                review.getUser().initials(),
                review.getRating(),
                review.getTitle(),
                review.getComment(),
                review.isDeleted(),
                review.isDeleted() ? review.getDeleteReason() : null,
                review.getCreatedAt(),
                review.getUpdatedAt());
    }

    /** Owner or admin view: booking context included, moderation state visible. */
    public ReviewResponse toOwnerResponse(Review review) {
        if (review == null) {
            return null;
        }
        return new ReviewResponse(
                review.getId(),
                review.getVehicle().getId(),
                review.getVehicle().displayName(),
                review.getBooking().getId(),
                review.getBooking().getBookingReference(),
                review.getUser().getFirstName(),
                review.getUser().initials(),
                review.getRating(),
                review.getTitle(),
                review.getComment(),
                review.isDeleted(),
                review.getDeleteReason(),
                review.getCreatedAt(),
                review.getUpdatedAt());
    }
}

package com.driveease.repository.spec;

import com.driveease.entity.Review;
import org.springframework.data.jpa.domain.Specification;

public final class ReviewSpecifications {

    private ReviewSpecifications() {
    }

    public static Specification<Review> notDeleted() {
        return (root, query, cb) -> cb.isFalse(root.get("deleted"));
    }

    public static Specification<Review> includeDeleted(boolean include) {
        return (root, query, cb) -> include ? cb.conjunction() : cb.isFalse(root.get("deleted"));
    }

    public static Specification<Review> forVehicle(Long vehicleId) {
        return (root, query, cb) -> vehicleId == null ? cb.conjunction() : cb.equal(root.get("vehicle").get("id"), vehicleId);
    }

    public static Specification<Review> ratingAtMost(Integer rating) {
        return (root, query, cb) -> rating == null ? cb.conjunction() : cb.lessThanOrEqualTo(root.get("rating"), rating);
    }
}

package com.driveease.repository.spec;

import com.driveease.entity.Payment;
import com.driveease.entity.PaymentStatus;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

public final class PaymentSpecifications {

    private PaymentSpecifications() {
    }

    public static Specification<Payment> hasStatus(PaymentStatus status) {
        return (root, query, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    public static Specification<Payment> reference(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) {
                return cb.conjunction();
            }
            String like = "%" + search.trim().toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("paymentReference")), like),
                    cb.like(cb.lower(root.get("transactionRef")), like)
            );
        };
    }

    public static Specification<Payment> createdBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from == null && to == null) {
                return cb.conjunction();
            }
            if (from == null) {
                return cb.lessThan(root.get("createdAt"), to);
            }
            if (to == null) {
                return cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            }
            return cb.between(root.get("createdAt"), from, to);
        };
    }
}

package com.driveease.repository.spec;

import com.driveease.entity.Booking;
import com.driveease.entity.BookingStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Admin/back-office filtering for bookings (US-03-07). */
public final class BookingSpecifications {

    private BookingSpecifications() {
    }

    public static Specification<Booking> hasStatus(BookingStatus status) {
        return (root, query, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    public static Specification<Booking> forUser(Long userId) {
        return (root, query, cb) -> userId == null ? cb.conjunction() : cb.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Booking> forVehicle(Long vehicleId) {
        return (root, query, cb) -> vehicleId == null ? cb.conjunction() : cb.equal(root.get("vehicle").get("id"), vehicleId);
    }

    public static Specification<Booking> fromDate(LocalDate start) {
        return (root, query, cb) -> start == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get("pickupDate"), start);
    }

    public static Specification<Booking> toDate(LocalDate end) {
        return (root, query, cb) -> end == null ? cb.conjunction() : cb.lessThanOrEqualTo(root.get("returnDate"), end);
    }

    public static Specification<Booking> referenceOrCustomer(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) {
                return cb.conjunction();
            }
            String like = "%" + search.trim().toLowerCase() + "%";
            List<Predicate> ors = new ArrayList<>();
            ors.add(cb.like(cb.lower(root.get("bookingReference")), like));
            jakarta.persistence.criteria.Join<Object, Object> user = root.join("user");
            ors.add(cb.like(cb.lower(user.get("email")), like));
            ors.add(cb.like(cb.lower(user.get("firstName")), like));
            ors.add(cb.like(cb.lower(user.get("lastName")), like));
            jakarta.persistence.criteria.Join<Object, Object> vehicle = root.join("vehicle");
            ors.add(cb.like(cb.lower(vehicle.get("make")), like));
            ors.add(cb.like(cb.lower(vehicle.get("model")), like));
            return cb.or(ors.toArray(new Predicate[0]));
        };
    }
}

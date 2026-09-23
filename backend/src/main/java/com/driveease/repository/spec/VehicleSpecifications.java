package com.driveease.repository.spec;

import com.driveease.entity.*;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Dynamic, database-side filtering for the vehicle catalogue (US-02-01/02).
 * Availability is expressed as a NOT EXISTS sub-query so the database never
 * returns vehicles that clash with an existing reservation.
 */
public final class VehicleSpecifications {

    private VehicleSpecifications() {
    }

    public static Specification<Vehicle> notRetired() {
        return (root, query, cb) -> cb.notEqual(root.get("status"), VehicleStatus.RETIRED);
    }

    public static Specification<Vehicle> hasStatus(VehicleStatus status) {
        return (root, query, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    public static Specification<Vehicle> hasLocation(String location) {
        return (root, query, cb) -> {
            if (isBlank(location)) {
                return cb.conjunction();
            }
            return cb.equal(cb.lower(root.get("location")), location.trim().toLowerCase());
        };
    }

    public static Specification<Vehicle> hasCategory(VehicleCategory category) {
        return (root, query, cb) -> category == null ? cb.conjunction() : cb.equal(root.get("category"), category);
    }

    public static Specification<Vehicle> hasFuelType(FuelType fuelType) {
        return (root, query, cb) -> fuelType == null ? cb.conjunction() : cb.equal(root.get("fuelType"), fuelType);
    }

    public static Specification<Vehicle> hasTransmission(Transmission transmission) {
        return (root, query, cb) -> transmission == null ? cb.conjunction() : cb.equal(root.get("transmission"), transmission);
    }

    public static Specification<Vehicle> minPrice(BigDecimal minPrice) {
        return (root, query, cb) -> minPrice == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get("dailyRate"), minPrice);
    }

    public static Specification<Vehicle> maxPrice(BigDecimal maxPrice) {
        return (root, query, cb) -> maxPrice == null ? cb.conjunction() : cb.lessThanOrEqualTo(root.get("dailyRate"), maxPrice);
    }

    public static Specification<Vehicle> minSeats(Integer seats) {
        return (root, query, cb) -> seats == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get("seats"), seats);
    }

    /** Free-text search over make, model and location. */
    public static Specification<Vehicle> matchesText(String text) {
        return (root, query, cb) -> {
            if (isBlank(text)) {
                return cb.conjunction();
            }
            String like = "%" + text.trim().toLowerCase() + "%";
            List<Predicate> ors = new ArrayList<>();
            ors.add(cb.like(cb.lower(root.get("make")), like));
            ors.add(cb.like(cb.lower(root.get("model")), like));
            ors.add(cb.like(cb.lower(root.get("location")), like));
            return cb.or(ors.toArray(new Predicate[0]));
        };
    }

    /** Only vehicles with no PENDING/CONFIRMED/ACTIVE booking in the requested window. */
    public static Specification<Vehicle> availableBetween(LocalDate pickupDate, LocalDate returnDate) {
        return (root, query, cb) -> {
            if (pickupDate == null || returnDate == null) {
                return cb.conjunction();
            }
            Subquery<Long> sub = query.subquery(Long.class);
            Root<Booking> booking = sub.from(Booking.class);
            sub.select(cb.literal(1L)).where(
                    cb.equal(booking.get("vehicle").get("id"), root.get("id")),
                    booking.get("status").in(List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE)),
                    cb.lessThan(booking.get("pickupDate"), returnDate),
                    cb.greaterThan(booking.get("returnDate"), pickupDate)
            );
            return cb.not(cb.exists(sub));
        };
    }

    /** Vehicle statuses that may be part of a bookable search result. */
    public static Specification<Vehicle> bookableOnly(boolean includeUnavailable) {
        return (root, query, cb) -> includeUnavailable
                ? cb.conjunction()
                : cb.equal(root.get("status"), VehicleStatus.AVAILABLE);
    }

    public static Specification<Vehicle> inCategories(Collection<VehicleCategory> categories) {
        return (root, query, cb) -> categories == null || categories.isEmpty()
                ? cb.conjunction()
                : root.get("category").in(categories);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

package com.driveease.repository.spec;

import com.driveease.entity.Role;
import com.driveease.entity.User;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dynamic, database-side filtering for the account list (PRD US-01-05).
 *
 * Predicates are only added when a filter is actually supplied. That matters on
 * PostgreSQL: a nullable bind parameter inside LOWER(... LIKE) has no inferable
 * type and the driver rejects it with "function lower(bytea) does not exist",
 * so the value is folded into a Java-built pattern instead.
 */
public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> hasRole(Role role) {
        return (root, query, cb) -> role == null ? cb.conjunction() : cb.equal(root.get("role"), role);
    }

    public static Specification<User> isActive(Boolean active) {
        return (root, query, cb) -> active == null ? cb.conjunction() : cb.equal(root.get("active"), active);
    }

    /** Free-text match across name and email. */
    public static Specification<User> matches(String search) {
        if (search == null || search.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        String pattern = "%" + search.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("email")), pattern),
                cb.like(cb.lower(root.get("firstName")), pattern),
                cb.like(cb.lower(root.get("lastName")), pattern));
    }

    /** Combines every supplied filter into a single conjunction. */
    public static Specification<User> withFilters(String search, Role role, Boolean active) {
        return Specification.where(matches(search))
                .and(hasRole(role))
                .and(isActive(active));
    }
}

package com.driveease.service;

import com.driveease.entity.Role;
import com.driveease.exception.InsufficientPermissionException;
import com.driveease.security.UserPrincipal;
import org.springframework.stereotype.Component;

/**
 * Guards the fleet-owner surface.
 *
 * <p>Both {@code FLEET_MANAGER} and {@code ADMIN} may own vehicles and take
 * bookings on them. Ownership is a property of the <em>user</em>, not the role:
 * an admin who adds vehicles is the owner of their own fleet ("fleet C"), and
 * their fleet console is scoped to that fleet exactly like any other fleet
 * partner's.</p>
 *
 * <p>This guard only rejects roles that must never touch the fleet surface
 * (customers and any future role). Ownership scoping is enforced separately,
 * per query, by always filtering on {@code principal.getId()}.</p>
 */
@Component
public class FleetAccessGuard {

    /**
     * Allows FLEET_MANAGER and ADMIN through. Rejects everyone else.
     * The caller is then expected to scope its own queries by
     * {@link UserPrincipal#getId()} so the admin only sees their own fleet
     * on the fleet surface.
     */
    public void requireFleetOwner(UserPrincipal principal) {
        if (principal == null) {
            throw new InsufficientPermissionException("Authentication is required.");
        }
        Role role = principal.getRole();
        if (role != Role.FLEET_MANAGER && role != Role.ADMIN) {
            throw new InsufficientPermissionException(
                "The fleet console is available to fleet partners and administrators only.");
        }
    }

    /**
     * Convenience: returns the caller's user id after verification. This is the
     * id used as the fleet-owner filter in every fleet-scoped query.
     */
    public Long requireFleetOwnerId(UserPrincipal principal) {
        requireFleetOwner(principal);
        return principal.getId();
    }
}

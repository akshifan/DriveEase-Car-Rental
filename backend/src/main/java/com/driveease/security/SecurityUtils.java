package com.driveease.security;

import com.driveease.entity.Role;
import com.driveease.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Convenience accessors for the authenticated principal. */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static UserPrincipal currentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            return null;
        }
        return principal;
    }

    public static UserPrincipal requireUser() {
        UserPrincipal principal = currentUserOrNull();
        if (principal == null) {
            throw new UnauthorizedException("Authentication is required for this operation.");
        }
        return principal;
    }

    public static Long currentUserId() {
        return requireUser().getId();
    }

    public static Role currentRole() {
        return requireUser().getRole();
    }

    public static boolean isAdmin() {
        UserPrincipal principal = currentUserOrNull();
        return principal != null && principal.getRole() == Role.ADMIN;
    }

    public static boolean isStaff() {
        UserPrincipal principal = currentUserOrNull();
        return principal != null && principal.getRole().isStaff();
    }
}

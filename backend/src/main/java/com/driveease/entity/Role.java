package com.driveease.entity;

/**
 * Platform roles. Authorities are derived by prefixing {@code ROLE_} to the name.
 */
public enum Role {
    CUSTOMER,
    FLEET_MANAGER,
    ADMIN;

    public String authority() {
        return "ROLE_" + name();
    }

    public boolean isStaff() {
        return this == FLEET_MANAGER || this == ADMIN;
    }

    public boolean isAdmin() {
        return this == ADMIN;
    }
}

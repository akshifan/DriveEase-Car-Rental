package com.driveease.dto.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PATCH /users/me - every field optional, email is deliberately immutable here
 * (PRD US-01-03).
 */
public record UpdateProfileRequest(
        @Size(max = 100) String firstName,
        @Size(max = 100) String lastName,
        @Pattern(regexp = "^$|^[+0-9\\-\\s()]{7,20}$", message = "Enter a valid phone number") String phone,
        @Size(max = 255) String address,
        @Size(max = 120) String city,
        @Size(max = 50) String licenseNo
) {
}

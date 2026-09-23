package com.driveease.dto.user;

import com.driveease.entity.Role;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        String fullName,
        String initials,
        String phone,
        String address,
        String city,
        Role role,
        String licenseNo,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime lastLoginAt
) {
}

package com.driveease.dto.auth;

import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Enter a valid email address")
        @Size(max = 255)
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
                 message = "Password must contain at least one letter and one number")
        String password,

        @NotBlank(message = "First name is required")
        @Size(max = 100)
        String firstName,

        @NotBlank(message = "Last name is required")
        @Size(max = 100)
        String lastName,

        @Pattern(regexp = "^$|^[+0-9\\-\\s()]{7,20}$", message = "Enter a valid phone number")
        String phone,

        @Size(max = 50)
        String licenseNo,

        @Size(max = 255) String address,
        @Size(max = 120) String city
) {
}

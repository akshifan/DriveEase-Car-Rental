package com.driveease.dto.auth;

import jakarta.validation.constraints.*;

public record RegisterFleetRequest(
    @NotBlank @Email @Size(max = 255) String email,

    @NotBlank
    @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
        message = "Password must contain at least one letter and one number")
    String password,

    @NotBlank @Size(max = 100) String firstName,
    @NotBlank @Size(max = 100) String lastName,

    @Pattern(regexp = "^$|^[+0-9\\-\\s()]{7,20}$", message = "Enter a valid phone number")
    String phone,

    @NotBlank @Size(max = 200) String companyName,
    @NotBlank @Size(max = 120) String city,
    @Min(1) @Max(10000) Integer estimatedFleetSize
) {
}

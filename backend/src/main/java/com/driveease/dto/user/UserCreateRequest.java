package com.driveease.dto.user;

import com.driveease.entity.Role;
import jakarta.validation.constraints.*;

/** Admin-side provisioning of staff accounts (fleet managers / admins). */
public record UserCreateRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Pattern(regexp = "^$|^[+0-9\\-\\s()]{7,20}$") String phone,
        @NotNull Role role
) {
}

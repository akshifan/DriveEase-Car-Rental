package com.driveease.dto.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserStatusUpdateRequest(
        @NotNull(message = "active flag is required") Boolean active,
        @Size(max = 255) String reason
) {
}

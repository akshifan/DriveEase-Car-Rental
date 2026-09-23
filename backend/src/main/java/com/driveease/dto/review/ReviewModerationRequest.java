package com.driveease.dto.review;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DELETE /reviews/{id} requires a moderation reason (PRD US-06-03). */
public record ReviewModerationRequest(
        @NotBlank(message = "A moderation reason is required")
        @Size(max = 255) String reason
) {
}

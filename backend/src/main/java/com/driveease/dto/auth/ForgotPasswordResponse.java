package com.driveease.dto.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * In development the reset link is echoed back so the flow can be exercised
 * without a mail provider; in production {@code resetToken} stays null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ForgotPasswordResponse(String message, String resetToken, Long expiresInMinutes) {
}

package com.driveease.dto.auth;

import com.driveease.dto.user.UserResponse;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response for /auth/login, /auth/register, /auth/verify-fleet-email.
 *
 * The refresh token is included in the body so Safari (which blocks
 * third-party cookies) can store it in localStorage and send it back
 * via the X-Refresh-Token header.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
    String accessToken,
    String tokenType,
    long expiresIn,
    String refreshToken,
    UserResponse user
) {
    public AuthResponse(String accessToken, long expiresIn, String refreshToken, UserResponse user) {
        this(accessToken, "Bearer", expiresIn, refreshToken, user);
    }
}

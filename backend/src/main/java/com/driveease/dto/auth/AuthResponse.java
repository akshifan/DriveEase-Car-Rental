package com.driveease.dto.auth;

import com.driveease.dto.user.UserResponse;

/**
 * Access token is returned in the body; the refresh token travels in an
 * HttpOnly cookie so it is never reachable from JavaScript.
 */
public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserResponse user
) {
    public AuthResponse(String accessToken, long expiresIn, UserResponse user) {
        this(accessToken, "Bearer", expiresIn, user);
    }
}

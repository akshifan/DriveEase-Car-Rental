package com.driveease.dto.auth;

public record RefreshResponse(String accessToken, String tokenType, long expiresIn) {
    public RefreshResponse(String accessToken, long expiresIn) {
        this(accessToken, "Bearer", expiresIn);
    }
}

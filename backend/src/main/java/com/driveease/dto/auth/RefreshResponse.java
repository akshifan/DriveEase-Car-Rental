package com.driveease.dto.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RefreshResponse(String accessToken, String tokenType, long expiresIn, String refreshToken) {
    public RefreshResponse(String accessToken, long expiresIn, String refreshToken) {
        this(accessToken, "Bearer", expiresIn, refreshToken);
    }
}

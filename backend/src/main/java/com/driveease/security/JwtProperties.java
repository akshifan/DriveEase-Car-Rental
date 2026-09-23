package com.driveease.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Bound from {@code driveease.jwt.*}. No secret ever has a production default. */
@Getter
@Setter
@ConfigurationProperties(prefix = "driveease.jwt")
public class JwtProperties {

    private String secret = "driveease-development-only-secret-key-change-me-32b";
    private String issuer = "driveease-api";
    private long accessTokenTtlSeconds = 3600;
    private long refreshTokenTtlSeconds = 604800;
    private long resetTokenTtlMinutes = 30;
    private Cookie cookie = new Cookie();

    @Getter
    @Setter
    public static class Cookie {
        private String refreshName = "driveease_refresh";
        private boolean secure = false;
        private String sameSite = "Lax";
        private String domain = "";
        private String path = "/api/v1/auth";
    }
}

package com.driveease.security;

import com.driveease.entity.Role;
import com.driveease.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/** Issues and validates the short-lived access token (HS256). */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final JwtProperties properties;
    private SecretKey signingKey;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        byte[] keyBytes = properties.getSecret().getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "driveease.jwt.secret must be at least 32 bytes for HS256. Configure JWT_SECRET.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(String.valueOf(user.getId()))
                .issuer(properties.getIssuer())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("name", user.fullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(properties.getAccessTokenTtlSeconds())))
                .signWith(signingKey)
                .compact();
    }

    public long accessTokenTtlSeconds() {
        return properties.getAccessTokenTtlSeconds();
    }

    public long refreshTokenTtlSeconds() {
        return properties.getRefreshTokenTtlSeconds();
    }

    /** Parses a token, returning null when it is malformed, expired or badly signed. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(properties.getIssuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Rejected JWT: {}", ex.getMessage());
            return null;
        }
    }

    public Long extractUserId(String token) {
        Claims claims = parse(token);
        return claims == null ? null : Long.valueOf(claims.getSubject());
    }

    public Role extractRole(String token) {
        Claims claims = parse(token);
        if (claims == null || claims.get("role") == null) {
            return null;
        }
        try {
            return Role.valueOf(claims.get("role", String.class));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}

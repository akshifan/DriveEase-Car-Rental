package com.driveease.security;

import com.driveease.entity.RefreshToken;
import com.driveease.entity.User;
import com.driveease.exception.UnauthorizedException;
import com.driveease.repository.RefreshTokenRepository;
import com.driveease.util.TokenHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

/**
 * Refresh tokens are opaque 256-bit random strings. The database stores only a
 * SHA-256 digest, so a database leak cannot be replayed as a session.
 *
 * <p>Every refresh rotates the token. Presenting an already-rotated token is
 * treated as reuse: the whole token family for that user is revoked.</p>
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;
    private final JwtProperties properties;

    public RefreshTokenService(RefreshTokenRepository repository, JwtProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public record IssuedToken(String rawToken, RefreshToken entity) {
    }

    @Transactional
    public IssuedToken issue(User user, String userAgent, String ipAddress) {
        String raw = generateRawToken();
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(TokenHasher.sha256Hex(raw));
        token.setExpiresAt(LocalDateTime.now().plusSeconds(properties.getRefreshTokenTtlSeconds()));
        token.setUserAgent(truncate(userAgent, 255));
        token.setIpAddress(truncate(ipAddress, 64));
        repository.save(token);
        return new IssuedToken(raw, token);
    }

    @Transactional
    public IssuedToken rotate(String rawToken, String userAgent, String ipAddress) {
        RefreshToken existing = repository.findByTokenHash(TokenHasher.sha256Hex(rawToken))
                .orElseThrow(() -> new UnauthorizedException("Refresh token is not recognised. Please sign in again."));

        if (existing.isRevoked()) {
            log.warn("Refresh token reuse detected for user {}. Revoking all sessions.", existing.getUser().getId());
            repository.revokeAllForUser(existing.getUser().getId(), LocalDateTime.now());
            throw new UnauthorizedException("This session has been invalidated. Please sign in again.");
        }
        if (!existing.isUsable()) {
            throw new UnauthorizedException("Refresh token has expired. Please sign in again.");
        }

        IssuedToken replacement = issue(existing.getUser(), userAgent, ipAddress);
        existing.revoke(replacement.entity().getId());
        repository.save(existing);
        return replacement;
    }

    @Transactional
    public void revoke(String rawToken) {
        repository.findByTokenHash(TokenHasher.sha256Hex(rawToken)).ifPresent(token -> {
            token.revoke(null);
            repository.save(token);
        });
    }

    @Transactional
    public void revokeAllForUser(Long userId) {
        repository.revokeAllForUser(userId, LocalDateTime.now());
    }

    @Transactional
    public int purgeExpired() {
        return repository.deleteExpired(LocalDateTime.now().minusDays(1));
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

package com.driveease.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Very small per-IP rate limiter for the public authentication endpoints.
 * Not distributed — for a single-instance deployment only. Behind a load
 * balancer, terminate this at the edge (Cloudflare, Nginx, etc.) as well.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 10;        // per window per IP
    private static final long WINDOW_SECONDS = 60;     // 1 minute

    private record Bucket(AtomicInteger count, long windowStartEpoch) { }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Only the publicly exposed registration / verification endpoints.
        return !(path.equals("/api/v1/auth/register")
            || path.equals("/api/v1/auth/register-fleet")
            || path.equals("/api/v1/auth/verify-fleet-email")
            || path.equals("/api/v1/auth/resend-fleet-verification")
            || path.equals("/api/v1/auth/forgot-password")
            || path.equals("/api/v1/auth/reset-password"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = clientIp(request);
        long now = Instant.now().getEpochSecond();

        Bucket bucket = buckets.compute(ip, (key, existing) -> {
            if (existing == null || now - existing.windowStartEpoch() >= WINDOW_SECONDS) {
                return new Bucket(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });

        // Opportunistic cleanup: 1-in-200 requests sweeps stale buckets.
        if (Math.random() < 0.005) {
            buckets.entrySet().removeIf(e -> now - e.getValue().windowStartEpoch() >= WINDOW_SECONDS * 2);
        }

        if (bucket.count().get() > MAX_REQUESTS) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                "{\"code\":\"TOO_MANY_REQUESTS\",\"message\":\"Too many attempts. Try again in a minute.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

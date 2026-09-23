package com.driveease.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

/**
 * Writes the refresh token to an HttpOnly cookie so it is unreachable from
 * JavaScript, and reads it back on refresh / logout (PRD US-01-02).
 */
@Component
public class RefreshCookieService {

    private final JwtProperties properties;

    public RefreshCookieService(JwtProperties properties) {
        this.properties = properties;
    }

    public void write(HttpServletResponse response, String rawToken, long maxAgeSeconds) {
        StringBuilder cookie = new StringBuilder()
                .append(properties.getCookie().getRefreshName()).append('=')
                .append(rawToken == null ? "" : rawToken)
                .append("; Path=").append(properties.getCookie().getPath())
                .append("; Max-Age=").append(Math.max(0, maxAgeSeconds))
                .append("; HttpOnly")
                .append("; SameSite=").append(properties.getCookie().getSameSite());
        if (properties.getCookie().isSecure()) {
            cookie.append("; Secure");
        }
        if (properties.getCookie().getDomain() != null && !properties.getCookie().getDomain().isBlank()) {
            cookie.append("; Domain=").append(properties.getCookie().getDomain());
        }
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clear(HttpServletResponse response) {
        write(response, "", 0);
    }

    public String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (properties.getCookie().getRefreshName().equals(cookie.getName())) {
                String value = cookie.getValue();
                return value == null || value.isBlank() ? null : value;
            }
        }
        return null;
    }
}

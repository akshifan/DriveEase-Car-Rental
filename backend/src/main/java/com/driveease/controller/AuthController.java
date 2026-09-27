package com.driveease.controller;

import com.driveease.dto.auth.*;
import com.driveease.dto.common.MessageResponse;
import com.driveease.dto.user.UserResponse;
import com.driveease.security.RefreshCookieService;
import com.driveease.security.SecurityUtils;
import com.driveease.security.JwtProperties;
import com.driveease.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "Registration, login, token refresh, logout and password reset")
public class AuthController {

    private static final String REFRESH_HEADER = "X-Refresh-Token";

    private final AuthService authService;
    private final RefreshCookieService cookieService;
    private final JwtProperties jwtProperties;

    public AuthController(AuthService authService, RefreshCookieService cookieService, JwtProperties jwtProperties) {
        this.authService = authService;
        this.cookieService = cookieService;
        this.jwtProperties = jwtProperties;
    }

    @PostMapping("/register")
    @SecurityRequirements
    @Operation(summary = "Register a new customer account")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                                 HttpServletRequest httpRequest,
                                                 HttpServletResponse httpResponse) {
        AuthService.AuthResult result = authService.register(request, httpRequest.getHeader("User-Agent"),
            clientIp(httpRequest));
        // Also set cookie for desktop browsers (harmless if blocked on Safari)
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new AuthResponse(result.accessToken(), result.expiresIn(), result.refreshToken(), result.user()));
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(summary = "Authenticate and receive an access token")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        AuthService.AuthResult result = authService.login(request, httpRequest.getHeader("User-Agent"),
            clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return new AuthResponse(result.accessToken(), result.expiresIn(), result.refreshToken(), result.user());
    }

    @PostMapping("/refresh")
    @SecurityRequirements
    @Operation(summary = "Exchange a refresh token for a new access token")
    public RefreshResponse refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // Prefer header (Safari-safe), fall back to cookie (desktop).
        String rawToken = httpRequest.getHeader(REFRESH_HEADER);
        if (rawToken == null || rawToken.isBlank()) {
            rawToken = cookieService.read(httpRequest);
        }
        AuthService.AuthResult result = authService.refresh(rawToken, httpRequest.getHeader("User-Agent"),
            clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return new RefreshResponse(result.accessToken(), result.expiresIn(), result.refreshToken());
    }

    @PostMapping("/forgot-password")
    @SecurityRequirements
    @Operation(summary = "Request a password reset link")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    @SecurityRequirements
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return new MessageResponse("Your password has been updated. Please sign in.");
    }

    @PostMapping("/logout")
    @SecurityRequirements
    public MessageResponse logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String rawToken = httpRequest.getHeader(REFRESH_HEADER);
        if (rawToken == null || rawToken.isBlank()) {
            rawToken = cookieService.read(httpRequest);
        }
        authService.logout(rawToken);
        cookieService.clear(httpResponse);
        return new MessageResponse("You have been signed out.");
    }

    @PostMapping("/change-password")
    public MessageResponse changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                          HttpServletRequest httpRequest,
                                          HttpServletResponse httpResponse) {
        authService.changePassword(SecurityUtils.currentUserId(), request, cookieService.read(httpRequest));
        cookieService.clear(httpResponse);
        return new MessageResponse("Password changed. Please sign in again.");
    }

    @GetMapping("/session")
    public UserResponse session() {
        return authService.sessionUser(SecurityUtils.currentUserId());
    }

    @PostMapping("/register-fleet")
    @SecurityRequirements
    public ResponseEntity<MessageResponse> registerFleet(@Valid @RequestBody RegisterFleetRequest request) {
        authService.registerFleet(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new MessageResponse(
            "Thanks! Check your inbox to verify your email and activate your fleet account."));
    }

    @PostMapping("/verify-fleet-email")
    @SecurityRequirements
    public AuthResponse verifyFleetEmail(@Valid @RequestBody VerifyEmailRequest request,
                                         HttpServletRequest httpRequest,
                                         HttpServletResponse httpResponse) {
        AuthService.AuthResult result = authService.verifyFleetEmail(
            request.token(), httpRequest.getHeader("User-Agent"), clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return new AuthResponse(result.accessToken(), result.expiresIn(), result.refreshToken(), result.user());
    }

    @PostMapping("/resend-fleet-verification")
    @SecurityRequirements
    public ResponseEntity<MessageResponse> resendFleetVerification(
        @Valid @RequestBody ResendVerificationRequest request) {
        authService.resendFleetVerification(request.email());
        return ResponseEntity.accepted().body(new MessageResponse(
            "If that email is registered, a new verification link is on its way."));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

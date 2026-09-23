package com.driveease.controller;

import com.driveease.dto.auth.*;
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

/**
 * Authentication endpoints (PRD 5.1).
 *
 * The refresh token is delivered as an HttpOnly cookie scoped to
 * {@code /api/v1/auth}; it is therefore never readable from JavaScript and is
 * sent automatically by the browser on refresh/logout calls.
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "Registration, login, token refresh, logout and password reset")
public class AuthController {

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
    @Operation(summary = "Register a new customer account",
            description = "Creates a CUSTOMER account, returns a JWT access token and sets the refresh cookie. "
                    + "Privileged roles are provisioned by an administrator only.")
    @ApiResponse(responseCode = "201", description = "Account created")
    @ApiResponse(responseCode = "400", description = "Validation failed")
    @ApiResponse(responseCode = "409", description = "Email or licence already registered")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                                 HttpServletRequest httpRequest,
                                                 HttpServletResponse httpResponse) {
        AuthService.AuthResult result = authService.register(request, httpRequest.getHeader("User-Agent"),
                clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthResponse(result.accessToken(), result.expiresIn(), result.user()));
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(summary = "Authenticate and receive an access token")
    @ApiResponse(responseCode = "200", description = "Authenticated")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    @ApiResponse(responseCode = "403", description = "Account deactivated")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        AuthService.AuthResult result = authService.login(request, httpRequest.getHeader("User-Agent"),
                clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return new AuthResponse(result.accessToken(), result.expiresIn(), result.user());
    }

    @PostMapping("/refresh")
    @SecurityRequirements
    @Operation(summary = "Exchange the refresh cookie for a new access token",
            description = "Rotates the refresh token: the presented token is revoked and replaced. "
                    + "Replaying a rotated token revokes every session belonging to the user.")
    @ApiResponse(responseCode = "200", description = "Token refreshed")
    @ApiResponse(responseCode = "401", description = "Missing, expired or reused refresh token")
    public RefreshResponse refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String rawToken = cookieService.read(httpRequest);
        AuthService.AuthResult result = authService.refresh(rawToken, httpRequest.getHeader("User-Agent"),
                clientIp(httpRequest));
        cookieService.write(httpResponse, result.refreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return new RefreshResponse(result.accessToken(), result.expiresIn());
    }

    @PostMapping("/forgot-password")
    @SecurityRequirements
    @Operation(summary = "Request a password reset link",
            description = "Always answers 202 so the endpoint cannot be used to enumerate accounts. "
                    + "With the mock mail provider the token is echoed for local demos.")
    @ApiResponse(responseCode = "202", description = "Request accepted")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    @SecurityRequirements
    @Operation(summary = "Set a new password with a reset token",
            description = "The token is single use and expires after 30 minutes. "
                    + "A successful reset invalidates every existing session.")
    @ApiResponse(responseCode = "200", description = "Password updated")
    @ApiResponse(responseCode = "400", description = "Invalid or expired token")
    public com.driveease.dto.common.MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return new com.driveease.dto.common.MessageResponse("Your password has been updated. Please sign in.");
    }

    @PostMapping("/logout")
    @SecurityRequirements
    @Operation(summary = "Invalidate the refresh token")
    @ApiResponse(responseCode = "200", description = "Signed out")
    public com.driveease.dto.common.MessageResponse logout(HttpServletRequest httpRequest,
                                                          HttpServletResponse httpResponse) {
        authService.logout(cookieService.read(httpRequest));
        cookieService.clear(httpResponse);
        return new com.driveease.dto.common.MessageResponse("You have been signed out.");
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change the password of the authenticated account",
            description = "Revokes every refresh token for the account after a successful change.")
    public com.driveease.dto.common.MessageResponse changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                                  HttpServletRequest httpRequest,
                                                                  HttpServletResponse httpResponse) {
        authService.changePassword(SecurityUtils.currentUserId(), request, cookieService.read(httpRequest));
        cookieService.clear(httpResponse);
        return new com.driveease.dto.common.MessageResponse("Password changed. Please sign in again.");
    }

    @GetMapping("/session")
    @Operation(summary = "Return the authenticated account", description = "Used by the SPA on boot to restore a session.")
    public UserResponse session() {
        return authService.sessionUser(SecurityUtils.currentUserId());
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

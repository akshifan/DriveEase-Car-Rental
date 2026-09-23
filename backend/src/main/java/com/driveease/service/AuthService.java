package com.driveease.service;

import com.driveease.dto.auth.*;
import com.driveease.dto.user.UserResponse;
import com.driveease.entity.*;
import com.driveease.exception.DuplicateResourceException;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.UnauthorizedException;
import com.driveease.mapper.UserMapper;
import com.driveease.repository.PasswordResetTokenRepository;
import com.driveease.repository.UserRepository;
import com.driveease.security.*;
import com.driveease.util.TokenHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Registration, login, refresh, logout and the password reset flow.
 *
 * <p>Security properties:</p>
 * <ul>
 *   <li>passwords are stored as BCrypt hashes through a DelegatingPasswordEncoder;</li>
 *   <li>refresh tokens are opaque, hashed at rest, rotated on every use, and reused
 *       tokens revoke the whole family;</li>
 *   <li>password reset tokens are single-use, hash-stored and expire in 30 minutes,
 *       and a successful reset invalidates every active session;</li>
 *   <li>the API never reveals whether an email exists (forgot-password always 202).</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final AuditService auditService;
    private final UserMapper userMapper;

    public AuthService(UserRepository userRepository,
                       PasswordResetTokenRepository resetTokenRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       NotificationService notificationService,
                       EmailService emailService,
                       AuditService auditService,
                       UserMapper userMapper) {
        this.userRepository = userRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.auditService = auditService;
        this.userMapper = userMapper;
    }

    public record AuthResult(String accessToken, long expiresIn, UserResponse user, String refreshToken) {
    }

    @Transactional
    public AuthResult register(RegisterRequest request, String userAgent, String ipAddress) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException("EMAIL_ALREADY_REGISTERED",
                    "An account with this email already exists. Try signing in instead.");
        }
        if (request.licenseNo() != null && !request.licenseNo().isBlank()
                && userRepository.existsByLicenseNoIgnoreCase(request.licenseNo().trim())) {
            throw new DuplicateResourceException("LICENSE_ALREADY_REGISTERED",
                    "This driving licence number is already registered.");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(blankToNull(request.phone()));
        user.setAddress(blankToNull(request.address()));
        user.setCity(blankToNull(request.city()));
        user.setLicenseNo(blankToNull(request.licenseNo()));
        user.setRole(Role.CUSTOMER);   // privileged roles are provisioned by an admin only
        user.setActive(true);
        User saved = userRepository.save(user);

        auditService.recordSystem(AuditAction.USER_REGISTERED, "User", saved.getId(),
                "Account registered: " + saved.getEmail(), "role=CUSTOMER");
        emailService.sendWelcome(saved.getEmail(), saved.getFirstName());
        notificationService.notify(saved, NotificationType.ACCOUNT_STATUS, "Welcome to DriveEase",
                "Your account is ready. Start by exploring the fleet.", "/vehicles");

        log.info("New customer registered: {}", saved.getEmail());
        String accessToken = jwtService.generateAccessToken(saved);
        String refreshToken = refreshTokenService.issue(saved, userAgent, ipAddress).rawToken();
        return new AuthResult(accessToken, jwtService.accessTokenTtlSeconds(), userMapper.toResponse(saved), refreshToken);
    }

    @Transactional
    public AuthResult login(LoginRequest request, String userAgent, String ipAddress) {
        String email = request.email().trim().toLowerCase();
        // DaoAuthenticationProvider throws BadCredentials/Disabled, translated by GlobalExceptionHandler.
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.password()));

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("Account is no longer available."));

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user, userAgent, ipAddress).rawToken();
        log.info("User {} signed in", user.getEmail());
        return new AuthResult(accessToken, jwtService.accessTokenTtlSeconds(), userMapper.toResponse(user), refreshToken);
    }

    @Transactional
    public AuthResult refresh(String rawRefreshToken, String userAgent, String ipAddress) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("No refresh token was supplied.");
        }
        RefreshTokenService.IssuedToken rotated = refreshTokenService.rotate(rawRefreshToken, userAgent, ipAddress);
        User user = rotated.entity().getUser();
        if (!user.isActive()) {
            refreshTokenService.revokeAllForUser(user.getId());
            throw new UnauthorizedException("This account is deactivated.");
        }
        return new AuthResult(jwtService.generateAccessToken(user), jwtService.accessTokenTtlSeconds(),
                userMapper.toResponse(user), rotated.rawToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken != null) {
            refreshTokenService.revoke(rawRefreshToken);
        }
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        var maybeUser = userRepository.findByEmailIgnoreCase(email);
        String generic = "If an account exists for that email, a reset link is on its way.";

        if (maybeUser.isEmpty()) {
            // Same response shape and timing characteristics as the success path.
            log.info("Password reset requested for unknown email {}", email);
            return new ForgotPasswordResponse(generic, null, null);
        }

        User user = maybeUser.get();
        resetTokenRepository.invalidateAllForUser(user.getId(), LocalDateTime.now());

        String rawToken = TokenHasher.randomToken(32);
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(TokenHasher.sha256Hex(rawToken));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(30));
        resetTokenRepository.save(token);

        emailService.sendPasswordReset(user.getEmail(), user.getFirstName(), rawToken);
        log.info("Password reset token issued for {}", user.getEmail());

        boolean devExposure = emailServiceExposesTokens();
        return new ForgotPasswordResponse(generic, devExposure ? rawToken : null, devExposure ? 30L : null);
    }

    /**
     * The reset token is echoed in the response only when the mock mail provider is
     * active (local/demo). With a real provider the token travels exclusively
     * through email, so a caller cannot reset an account they do not own.
     */
    private boolean emailServiceExposesTokens() {
        return emailService.isMockProvider();
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(TokenHasher.sha256Hex(request.token()))
                .orElseThrow(() -> InvalidRequestException.badRequest("INVALID_RESET_TOKEN",
                        "This password reset link is not valid. Please request a new one."));
        if (!token.isUsable()) {
            throw InvalidRequestException.badRequest("RESET_TOKEN_EXPIRED",
                    "This password reset link has expired or has already been used.");
        }
        User user = token.getUser();
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw InvalidRequestException.unprocessable("PASSWORD_UNCHANGED",
                    "The new password must be different from the current one.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        token.markUsed();
        resetTokenRepository.save(token);
        resetTokenRepository.invalidateAllForUser(user.getId(), LocalDateTime.now());
        refreshTokenService.revokeAllForUser(user.getId());   // existing sessions are invalidated

        notificationService.notify(user, NotificationType.ACCOUNT_STATUS, "Password changed",
                "Your password was reset. If this was not you, contact support immediately.", "/profile");
        log.info("Password reset completed for {}", user.getEmail());
    }

    /** Session bootstrap for the SPA: returns the account behind the access token. */
    @Transactional(readOnly = true)
    public com.driveease.dto.user.UserResponse sessionUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Account is no longer available."));
        return userMapper.toResponse(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request, String rawRefreshToken) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Account is no longer available."));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Current password is incorrect.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        refreshTokenService.revokeAllForUser(userId);
        if (rawRefreshToken != null) {
            refreshTokenService.revoke(rawRefreshToken);
        }
        notificationService.notify(user, NotificationType.ACCOUNT_STATUS, "Password changed",
                "Your password was updated successfully.", "/profile");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

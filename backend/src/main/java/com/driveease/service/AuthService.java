package com.driveease.service;

import com.driveease.dto.auth.*;
import com.driveease.dto.common.MessageResponse;
import com.driveease.dto.user.UserResponse;
import com.driveease.entity.*;
import com.driveease.exception.DuplicateResourceException;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.UnauthorizedException;
import com.driveease.mapper.UserMapper;
import com.driveease.repository.PasswordResetTokenRepository;
import com.driveease.repository.UserRepository;
import com.driveease.repository.spec.UserSpecifications;
import com.driveease.security.*;
import com.driveease.util.TokenHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Registration, login, refresh, logout, password reset and the two self-service
 * onboarding flows.
 *
 * <p>Two distinct registration paths exist:</p>
 * <ul>
 *   <li>{@link #register} — public customer sign-up. Account is immediately usable,
 *       role is forced to CUSTOMER.</li>
 *   <li>{@link #registerFleet} — public fleet-partner sign-up (Option B). Account is
 *       created as FLEET_MANAGER but {@code email_verified = false}, so it cannot
 *       authenticate until the partner clicks the verification link emailed to them.</li>
 * </ul>
 *
 * <p>Security properties preserved across both paths:</p>
 * <ul>
 *   <li>passwords are stored as BCrypt hashes through a DelegatingPasswordEncoder;</li>
 *   <li>refresh tokens are opaque, hashed at rest, rotated on every use, and reused
 *       tokens revoke the whole family;</li>
 *   <li>password reset tokens are single-use, hash-stored and expire in 30 minutes,
 *       and a successful reset invalidates every active session;</li>
 *   <li>the API never reveals whether an email exists (forgot-password and
 *       resend-verification always return the same shape).</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /** Fleet verification links are valid for 48 hours. */
    private static final long FLEET_VERIFICATION_TTL_HOURS = 48;

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
    @Value("${driveease.fleet.auto-verify:false}")
    private boolean autoVerifyFleetAccounts;

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

    /** Carries the access token plus the raw refresh token that will be set as a cookie. */
    public record AuthResult(String accessToken, long expiresIn, UserResponse user, String refreshToken) {
    }

    // =========================================================================
    // Customer registration
    // =========================================================================

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
        user.setEmailVerified(true);   // customers are not required to verify — unchanged behaviour
        User saved = userRepository.save(user);

        auditService.recordSystem(AuditAction.USER_REGISTERED, "User", saved.getId(),
            "Account registered: " + saved.getEmail(), "role=CUSTOMER");
        emailService.sendWelcome(saved.getEmail(), saved.getFirstName());
        notificationService.notify(saved, NotificationType.ACCOUNT_STATUS, "Welcome to DriveEase",
            "Your account is ready. Start by exploring the fleet.", "/vehicles");

        log.info("New customer registered: {}", saved.getEmail());
        String accessToken = jwtService.generateAccessToken(saved);
        String refreshToken = refreshTokenService.issue(saved, userAgent, ipAddress).rawToken();
        return new AuthResult(accessToken, jwtService.accessTokenTtlSeconds(),
            userMapper.toResponse(saved), refreshToken);
    }

    // =========================================================================
    // Fleet-partner self-registration (Option B: public + email verification)
    // =========================================================================

    /**
     * Creates a FLEET_MANAGER account that cannot sign in until the partner clicks
     * the verification link. No admin approval is required — but the account is
     * inert without a working inbox, which filters out scripted abuse.
     *
     * <p>Deliberately returns nothing: the SPA shows a generic "check your email"
     * screen, and the same response shape is returned regardless of whether the
     * address was already registered. That prevents the endpoint being used to
     * probe which emails exist.</p>
     */
    @Transactional
    public void registerFleet(RegisterFleetRequest request) {
        String email = request.email().trim().toLowerCase();

        // Silently succeed on duplicate emails: same UX whether or not the account exists.
        if (userRepository.existsByEmailIgnoreCase(email)) {
            log.info("Fleet registration requested for existing email {}", email);
            return;
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(blankToNull(request.phone()));
        user.setCity(request.city().trim());
        user.setAddress("Fleet partner: " + request.companyName().trim());
        user.setRole(Role.FLEET_MANAGER);
        user.setActive(true);
        user.setEmailVerified(false);
        user.setVerificationToken(TokenHasher.randomToken(32));
        user.setVerificationSentAt(LocalDateTime.now());
        User saved = userRepository.save(user);

        if (autoVerifyFleetAccounts) {
            saved.setEmailVerified(true);
            saved.setVerificationToken(null);
            saved.setVerificationSentAt(null);
            userRepository.save(saved);
            log.warn("driveease.fleet.auto-verify is ON — {} was verified without clicking the link.", saved.getEmail());
            }

        emailService.sendFleetVerification(
            saved.getEmail(),
            saved.getFirstName(),
            request.companyName().trim(),
            saved.getVerificationToken());

        // Every admin gets a heads-up. Not an approval gate — just visibility.
        List<User> admins = userRepository.findAll(UserSpecifications.hasRole(Role.ADMIN));
        for (User admin : admins) {
            notificationService.notify(admin, NotificationType.ACCOUNT_STATUS,
                "New fleet partner registered",
                saved.getFirstName() + " " + saved.getLastName() + " (" + saved.getEmail()
                    + ") joined as a fleet partner for " + request.companyName() + ".",
                "/admin/users");
        }

        auditService.recordSystem(AuditAction.USER_REGISTERED, "User", saved.getId(),
            "Fleet manager self-registered (email verification pending): " + saved.getEmail(),
            "company=" + request.companyName() + ", fleet=" + request.estimatedFleetSize());
        log.info("Fleet registration created (verification pending): {}", saved.getEmail());
    }

    /**
     * Marks the fleet account's email as verified and immediately returns a
     * session so the frontend can log the user in without a second call.
     *
     * The token is single-use; an already-cleared token no longer matches, so a
     * replayed link answers with INVALID_VERIFICATION_TOKEN.
     */
    @Transactional
    public AuthResult verifyFleetEmail(String rawToken, String userAgent, String ipAddress) {
        if (rawToken == null || rawToken.isBlank()) {
            throw InvalidRequestException.badRequest("INVALID_VERIFICATION_TOKEN",
                "This verification link is not valid.");
        }
        User user = userRepository.findByVerificationToken(rawToken)
            .orElseThrow(() -> InvalidRequestException.badRequest("INVALID_VERIFICATION_TOKEN",
                "This verification link is not valid or has already been used."));

        if (user.getVerificationSentAt() != null
            && user.getVerificationSentAt().isBefore(
            LocalDateTime.now().minusHours(FLEET_VERIFICATION_TTL_HOURS))) {
            throw InvalidRequestException.badRequest("VERIFICATION_TOKEN_EXPIRED",
                "This verification link has expired. Request a new one from the sign-in page.");
        }

        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setVerificationSentAt(null);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        notificationService.notify(user, NotificationType.ACCOUNT_STATUS,
            "Fleet account verified",
            "Your DriveEase fleet account is ready. Welcome aboard.",
            "/console");
        auditService.recordSystem(AuditAction.USER_ACTIVATED, "User", user.getId(),
            "Fleet account email verified: " + user.getEmail(), null);
        log.info("Fleet account verified and signed in: {}", user.getEmail());

        // Return a full session: access token + refresh cookie, exactly like login.
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user, userAgent, ipAddress).rawToken();
        return new AuthResult(accessToken, jwtService.accessTokenTtlSeconds(),
            userMapper.toResponse(user), refreshToken);
    }

    /**
     * Re-issues a verification link for an unverified fleet account.
     * Always answers the same way regardless of whether the address exists, so it
     * cannot be used to enumerate accounts.
     */
    @Transactional
    public void resendFleetVerification(String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
            .filter(user -> !user.isEmailVerified())
            .filter(user -> user.getRole() == Role.FLEET_MANAGER)
            .ifPresent(user -> {
                user.setVerificationToken(TokenHasher.randomToken(32));
                user.setVerificationSentAt(LocalDateTime.now());
                userRepository.save(user);
                emailService.sendFleetVerification(
                    user.getEmail(),
                    user.getFirstName(),
                    "your fleet",
                    user.getVerificationToken());
                log.info("Fleet verification resent to {}", user.getEmail());
            });
    }

    // =========================================================================
    // Login / refresh / logout
    // =========================================================================

    @Transactional
    public AuthResult login(LoginRequest request, String userAgent, String ipAddress) {
        String email = request.email().trim().toLowerCase();

        // DaoAuthenticationProvider throws BadCredentials/Disabled, translated by
        // GlobalExceptionHandler. Disabled covers inactive accounts.
        var authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(email, request.password()));

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new UnauthorizedException("Account is no longer available."));

        // Fleet partners must click the verification link before they can sign in.
        if (!user.isEmailVerified()) {
            throw InvalidRequestException.unprocessable("EMAIL_NOT_VERIFIED",
                "Please verify your email first. We sent a verification link to " + user.getEmail()
                    + " when you signed up.");
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user, userAgent, ipAddress).rawToken();
        log.info("User {} signed in", user.getEmail());
        return new AuthResult(accessToken, jwtService.accessTokenTtlSeconds(),
            userMapper.toResponse(user), refreshToken);
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
        // If the account was de-verified between sessions (rare), enforce it here too.
        if (!user.isEmailVerified()) {
            refreshTokenService.revokeAllForUser(user.getId());
            throw new UnauthorizedException("Verify your email before continuing.");
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

    // =========================================================================
    // Password reset
    // =========================================================================

    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        var maybeUser = userRepository.findByEmailIgnoreCase(email);
        String generic = "If an account exists for that email, a reset link is on its way.";

        if (maybeUser.isEmpty()) {
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

        boolean devExposure = emailService.isMockProvider();
        return new ForgotPasswordResponse(generic, devExposure ? rawToken : null, devExposure ? 30L : null);
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

    // =========================================================================
    // Session + password change
    // =========================================================================

    /** Session bootstrap for the SPA: returns the account behind the access token. */
    @Transactional(readOnly = true)
    public UserResponse sessionUser(Long userId) {
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

    // =========================================================================
    // Helpers
    // =========================================================================

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

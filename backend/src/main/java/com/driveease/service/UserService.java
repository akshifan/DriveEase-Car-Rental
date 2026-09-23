package com.driveease.service;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.user.*;
import com.driveease.entity.AuditAction;
import com.driveease.entity.Role;
import com.driveease.entity.User;
import com.driveease.exception.DuplicateResourceException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.mapper.UserMapper;
import com.driveease.repository.UserRepository;
import com.driveease.repository.spec.UserSpecifications;
import com.driveease.security.RefreshTokenService;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final UserMapper userMapper;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       RefreshTokenService refreshTokenService,
                       NotificationService notificationService,
                       AuditService auditService,
                       UserMapper userMapper) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.userMapper = userMapper;
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userMapper.toResponse(requireUser(userId));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = requireUser(userId);
        if (request.firstName() != null && !request.firstName().isBlank()) {
            user.setFirstName(request.firstName().trim());
        }
        if (request.lastName() != null && !request.lastName().isBlank()) {
            user.setLastName(request.lastName().trim());
        }
        if (request.phone() != null) {
            user.setPhone(request.phone().isBlank() ? null : request.phone().trim());
        }
        if (request.address() != null) {
            user.setAddress(request.address().isBlank() ? null : request.address().trim());
        }
        if (request.city() != null) {
            user.setCity(request.city().isBlank() ? null : request.city().trim());
        }
        if (request.licenseNo() != null && !request.licenseNo().isBlank()) {
            String licence = request.licenseNo().trim();
            if (userRepository.existsByLicenseNoIgnoreCaseAndIdNot(licence, user.getId())) {
                throw new DuplicateResourceException("LICENSE_ALREADY_REGISTERED",
                        "This driving licence number is already registered to another account.");
            }
            user.setLicenseNo(licence);
        }
        return userMapper.toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(String search, Role role, Boolean active, Pageable pageable) {
        return PageResponse.of(
                userRepository.findAll(UserSpecifications.withFilters(blankToNull(search), role, active), pageable),
                userMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse byId(Long id) {
        return userMapper.toResponse(requireUser(id));
    }

    /** Admin: activate or deactivate an account (PRD US-01-05). */
    @Transactional
    public UserResponse updateStatus(Long id, UserStatusUpdateRequest request) {
        User user = requireUser(id);
        if (user.getRole() == Role.ADMIN && !request.active()) {
            if (userRepository.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
                throw new com.driveease.exception.InvalidRequestException(
                        "The last active administrator account cannot be deactivated.");
            }
        }
        boolean changed = user.isActive() != request.active();
        user.setActive(request.active());
        User saved = userRepository.save(user);

        if (!request.active()) {
            refreshTokenService.revokeAllForUser(id);   // deactivation kills live sessions
        }
        if (changed) {
            auditService.record(request.active() ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
                    "User", id, (request.active() ? "Activated " : "Deactivated ") + user.getEmail(),
                    request.reason());
            notificationService.notifyUser(id, com.driveease.entity.NotificationType.ACCOUNT_STATUS,
                    request.active() ? "Account reactivated" : "Account deactivated",
                    request.active() ? "Your DriveEase account is active again."
                            : "Your account has been deactivated by an administrator.",
                    "/profile");
        }
        return userMapper.toResponse(saved);
    }

    /** Admin: provision a fleet manager or admin account. */
    @Transactional
    public UserResponse createStaff(UserCreateRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException("EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(blankToNull(request.phone()));
        user.setRole(request.role());
        user.setActive(true);
        User saved = userRepository.save(user);
        auditService.record(AuditAction.USER_REGISTERED, "User", saved.getId(),
                "Staff account created: " + saved.getEmail(), "role=" + saved.getRole());
        return userMapper.toResponse(saved);
    }

    private User requireUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

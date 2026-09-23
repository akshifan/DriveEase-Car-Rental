package com.driveease.controller;

import com.driveease.dto.common.MessageResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.user.*;
import com.driveease.entity.Role;
import com.driveease.security.SecurityUtils;
import com.driveease.service.NotificationService;
import com.driveease.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Profile self-service and user administration (PRD 5.2). */
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "Profile management, notifications and admin user administration")
public class UserController {

    private final UserService userService;
    private final NotificationService notificationService;

    public UserController(UserService userService, NotificationService notificationService) {
        this.userService = userService;
        this.notificationService = notificationService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get the authenticated user's profile")
    public UserResponse me() {
        return userService.me(SecurityUtils.currentUserId());
    }

    @PatchMapping("/me")
    @Operation(summary = "Update profile (name, phone, address, city, licence)",
            description = "Email is intentionally immutable through this endpoint (PRD US-01-03).")
    public UserResponse updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(SecurityUtils.currentUserId(), request);
    }

    @GetMapping("/me/notifications")
    @Operation(summary = "List notifications for the authenticated account")
    public PageResponse<NotificationResponse> notifications(
            @PageableDefault(size = 10) Pageable pageable) {
        return notificationService.list(SecurityUtils.currentUserId(), pageable);
    }

    @GetMapping("/me/notifications/unread-count")
    @Operation(summary = "Number of unread notifications")
    public java.util.Map<String, Long> unreadCount() {
        return java.util.Map.of("unread", notificationService.unreadCount(SecurityUtils.currentUserId()));
    }

    @PostMapping("/me/notifications/read")
    @Operation(summary = "Mark every notification as read")
    public MessageResponse markNotificationsRead() {
        int updated = notificationService.markAllRead(SecurityUtils.currentUserId());
        return new MessageResponse(updated + " notification(s) marked as read.");
    }

    // ------------------------------------------------------------- admin only

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all users with optional search, role and status filters")
    public PageResponse<UserResponse> list(@RequestParam(required = false) String search,
                                           @RequestParam(required = false) Role role,
                                           @RequestParam(required = false) Boolean active,
                                           @PageableDefault(size = 20) Pageable pageable) {
        return userService.search(search, role, active, pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get any user by id")
    public UserResponse byId(@PathVariable Long id) {
        return userService.byId(id);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Activate or deactivate a user account",
            description = "Deactivation immediately revokes the user's refresh tokens and is written to the audit trail.")
    public UserResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UserStatusUpdateRequest request) {
        return userService.updateStatus(id, request);
    }

    @PostMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Provision a FLEET_MANAGER or ADMIN account")
    public ResponseEntity<UserResponse> createStaff(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createStaff(request));
    }
}

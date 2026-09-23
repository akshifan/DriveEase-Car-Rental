package com.driveease.mapper;

import com.driveease.dto.user.NotificationResponse;
import com.driveease.dto.user.UserResponse;
import com.driveease.entity.Notification;
import com.driveease.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        if (user == null) {
            return null;
        }
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.fullName(),
                user.initials(),
                user.getPhone(),
                user.getAddress(),
                user.getCity(),
                user.getRole(),
                user.getLicenseNo(),
                user.isActive(),
                user.getCreatedAt(),
                user.getLastLoginAt());
    }

    public NotificationResponse toResponse(Notification notification) {
        if (notification == null) {
            return null;
        }
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getLink(),
                notification.isRead(),
                notification.getCreatedAt());
    }
}

package com.driveease.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(length = 20)
    private String phone;

    @Column(length = 255)
    private String address;

    @Column(length = 120)
    private String city;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.CUSTOMER;

    @Column(name = "license_no", length = 50)
    private String licenseNo;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = true;

    @Column(name = "verification_token", length = 128)
    private String verificationToken;

    @Column(name = "verification_sent_at")
    private LocalDateTime verificationSentAt;

    public String fullName() {
        return firstName + " " + lastName;
    }

    /** Initials used by the avatar placeholder in the UI. */
    public String initials() {
        char first = firstName == null || firstName.isEmpty() ? 'D' : firstName.charAt(0);
        char last = lastName == null || lastName.isEmpty() ? 'E' : lastName.charAt(0);
        return ("" + first + last).toUpperCase();
    }
}

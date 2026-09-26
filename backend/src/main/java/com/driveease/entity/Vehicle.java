package com.driveease.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "vehicles")
public class Vehicle extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String make;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(nullable = false)
    private Integer year;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private VehicleCategory category;

    @Column(name = "license_plate", nullable = false, length = 20, unique = true)
    private String licensePlate;

    @Column(length = 40)
    private String vin;

    @Column(name = "daily_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRate;

    @Column(name = "deposit_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VehicleStatus status = VehicleStatus.AVAILABLE;

    @Column(length = 200)
    private String location;

    private Integer mileage;

    @Column(nullable = false)
    private Integer seats;

    private Integer doors;

    @Enumerated(EnumType.STRING)
    @Column(name = "fuel_type", nullable = false, length = 20)
    private FuelType fuelType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Transmission transmission;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(columnDefinition = "text")
    private String description;

    /** Comma separated amenity list, e.g. {@code "Apple CarPlay,360 Camera"}. */
    @Column(columnDefinition = "text")
    private String features;

    @Column(name = "retire_reason", length = 255)
    private String retireReason;

    @Column(name = "retired_at")
    private LocalDateTime retiredAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @OneToMany(mappedBy = "vehicle", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC, id ASC")
    private List<VehicleImage> images = new ArrayList<>();

    public String displayName() {
        return make + " " + model;
    }

    public List<String> featureList() {
        if (features == null || features.isBlank()) {
            return List.of();
        }
        return Arrays.stream(features.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }
}

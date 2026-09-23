package com.driveease.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "damage_records")
public class DamageRecord extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Column(nullable = false, length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DamageSeverity severity;

    @Column(name = "location_on_vehicle", length = 120)
    private String locationOnVehicle;

    @Column(name = "repair_estimate", precision = 10, scale = 2)
    private BigDecimal repairEstimate;

    @Column(name = "actual_repair_cost", precision = 10, scale = 2)
    private BigDecimal actualRepairCost;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DamageStatus status = DamageStatus.REPORTED;

    @Column(name = "reported_by")
    private Long reportedBy;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}

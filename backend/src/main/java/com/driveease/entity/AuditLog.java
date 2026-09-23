package com.driveease.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Immutable audit trail entry for privileged operations. */
@Getter
@Setter
@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_email", length = 255)
    private String actorEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private AuditAction action;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(columnDefinition = "text")
    private String details;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;
}

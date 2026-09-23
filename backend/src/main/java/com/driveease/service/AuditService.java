package com.driveease.service;

import com.driveease.entity.AuditAction;
import com.driveease.entity.AuditLog;
import com.driveease.repository.AuditLogRepository;
import com.driveease.security.SecurityUtils;
import com.driveease.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Writes the audit trail for privileged operations. Entries join the caller's
 * transaction so an audit record can never describe an operation that rolled back.
 */
@Service
public class AuditService {

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditAction action, String entityType, Long entityId, String summary, String details) {
        UserPrincipal principal = SecurityUtils.currentUserOrNull();
        AuditLog log = new AuditLog();
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setSummary(summary);
        log.setDetails(details);
        log.setIpAddress(currentIp());
        if (principal != null) {
            log.setActorId(principal.getId());
            log.setActorEmail(principal.getUsername());
        }
        repository.save(log);
    }

    /** Records an event performed outside an authenticated HTTP request (scheduler/seeding). */
    @Transactional(propagation = Propagation.REQUIRED)
    public void recordSystem(AuditAction action, String entityType, Long entityId, String summary, String details) {
        AuditLog log = new AuditLog();
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setSummary(summary);
        log.setDetails(details);
        log.setActorEmail("system");
        repository.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> list(Pageable pageable) {
        return repository.findAllByOrderByCreatedAtDesc(pageable);
    }

    private String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        }
        return null;
    }
}

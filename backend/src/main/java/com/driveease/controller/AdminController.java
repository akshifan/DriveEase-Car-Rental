package com.driveease.controller;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.report.DashboardResponse;
import com.driveease.dto.report.FleetPaymentSummary;
import com.driveease.entity.AuditLog;
import com.driveease.entity.BookingStatus;
import com.driveease.service.AdminFleetService;
import com.driveease.service.AuditService;
import com.driveease.service.BookingExportService;
import com.driveease.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/** Administrative workspace: dashboard, audit trail, fleet overview and CSV exports. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin", description = "Administrative dashboard, fleet overview, audit trail and booking CSV export")
public class AdminController {

    private final DashboardService dashboardService;
    private final BookingExportService bookingExportService;
    private final AuditService auditService;
    private final AdminFleetService adminFleetService;

    public AdminController(DashboardService dashboardService,
                           BookingExportService bookingExportService,
                           AuditService auditService,
                           AdminFleetService adminFleetService) {
        this.dashboardService = dashboardService;
        this.bookingExportService = bookingExportService;
        this.auditService = auditService;
        this.adminFleetService = adminFleetService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Platform dashboard")
    public DashboardResponse.AdminDashboard dashboard() {
        return dashboardService.adminDashboard();
    }

    @GetMapping("/fleets")
    @Operation(summary = "Every fleet partner with vehicle, booking and money totals")
    public List<AdminFleetService.FleetRow> fleets() {
        return adminFleetService.listAllFleets();
    }

    @GetMapping("/fleets/{id}/summary")
    @Operation(summary = "Money summary for a single fleet partner")
    public FleetPaymentSummary fleetSummary(@PathVariable Long id) {
        return adminFleetService.summaryForFleet(id);
    }

    @GetMapping(value = "/bookings/export", produces = "text/csv")
    @Operation(summary = "Export the booking overview as CSV")
    public ResponseEntity<byte[]> exportBookings(
        @RequestParam(required = false) BookingStatus status,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        @RequestParam(required = false) Long vehicleId,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) String search) {
        byte[] csv = bookingExportService.export(status, startDate, endDate, vehicleId, userId, search)
            .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"driveease-bookings.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv);
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Audit trail of privileged operations, newest first")
    public PageResponse<AuditLog> auditLogs(@PageableDefault(size = 25, sort = "createdAt",
        direction = Sort.Direction.DESC) Pageable pageable) {
        return PageResponse.of(auditService.list(pageable));
    }
}

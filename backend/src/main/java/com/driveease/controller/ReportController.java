package com.driveease.controller;

import com.driveease.dto.report.RevenueReportResponse;
import com.driveease.dto.report.UtilisationReportResponse;
import com.driveease.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/**
 * Reporting endpoints (PRD 5.5 / US-04-05 / US-05-05).
 * Accessible to ADMIN and FLEET_MANAGER; every aggregation is executed by PostgreSQL.
 */
@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize("hasAnyRole('ADMIN','FLEET_MANAGER')")
@Tag(name = "Reports", description = "Revenue and utilisation reporting with CSV export")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/revenue")
    @Operation(summary = "Revenue summary",
        description = """
                    Aggregated revenue for a date range with optional `groupBy` (day | week | month | category | branch).
                    Returns totals (gross, refunds, net, average booking value), a time series, and breakdowns by
                    category and branch. Defaults to the last 30 days when no range is supplied.
                    """)
    public RevenueReportResponse revenue(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required = false, defaultValue = "day") String groupBy,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String branch) {
        return reportService.revenue(from, to, groupBy, category, branch);
    }

    @GetMapping("/utilisation")
    @Operation(summary = "Fleet utilisation",
        description = "Rented days over available rental days per vehicle for the period, with revenue per vehicle. "
            + "Retired vehicles are excluded; days are clamped to the reporting window.")
    public UtilisationReportResponse utilisation(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.utilisation(from, to, null);
    }

    @GetMapping(value = "/revenue/export", produces = "text/csv")
    @Operation(summary = "Export the revenue series as CSV")
    public ResponseEntity<byte[]> exportRevenue(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required = false, defaultValue = "day") String groupBy,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String branch) {
        return csv(reportService.exportRevenueCsv(from, to, groupBy, category, branch), "driveease-revenue.csv");
    }

    @GetMapping(value = "/utilisation/export", produces = "text/csv")
    @Operation(summary = "Export the utilisation table as CSV")
    public ResponseEntity<byte[]> exportUtilisation(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return csv(reportService.exportUtilisationCsv(from, to), "driveease-utilisation.csv");
    }

    private ResponseEntity<byte[]> csv(String content, String filename) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(content.getBytes(StandardCharsets.UTF_8));
    }
}

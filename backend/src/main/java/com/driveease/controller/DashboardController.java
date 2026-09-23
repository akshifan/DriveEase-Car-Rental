package com.driveease.controller;

import com.driveease.dto.report.DashboardResponse;
import com.driveease.security.SecurityUtils;
import com.driveease.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer dashboard (PRD EPIC-02).
 *
 * Scoped to the authenticated caller: the user id comes from the JWT, never
 * from the request, so one customer can never read another's summary.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard", description = "Customer dashboard summary")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/customer")
    @Operation(summary = "Signed-in customer's summary: current trip, upcoming bookings, spend and review prompts")
    public DashboardResponse.CustomerDashboard customer() {
        return dashboardService.customerDashboard(SecurityUtils.currentUserId());
    }
}

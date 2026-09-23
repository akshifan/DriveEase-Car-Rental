package com.driveease.controller;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.report.DashboardResponse;
import com.driveease.dto.vehicle.*;
import com.driveease.entity.BookingStatus;
import com.driveease.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Fleet manager workspace (PRD EPIC-05).
 * Every endpoint requires FLEET_MANAGER or ADMIN (enforced by the security filter
 * chain and again with {@code @PreAuthorize}).
 */
@RestController
@RequestMapping("/api/v1/fleet")
@PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
@Tag(name = "Fleet", description = "Fleet dashboard, maintenance scheduling, damage logging and fleet exports")
public class FleetController {

    private final DashboardService dashboardService;
    private final MaintenanceService maintenanceService;
    private final DamageService damageService;
    private final BookingService bookingService;
    private final VehicleService vehicleService;
    private final VehicleHistoryService vehicleHistoryService;

    public FleetController(DashboardService dashboardService,
                           MaintenanceService maintenanceService,
                           DamageService damageService,
                           BookingService bookingService,
                           VehicleService vehicleService,
                           VehicleHistoryService vehicleHistoryService) {
        this.dashboardService = dashboardService;
        this.maintenanceService = maintenanceService;
        this.damageService = damageService;
        this.bookingService = bookingService;
        this.vehicleService = vehicleService;
        this.vehicleHistoryService = vehicleHistoryService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Fleet overview: status counts, upcoming bookings, maintenance and damage queue")
    public DashboardResponse.FleetDashboard dashboard() {
        return dashboardService.fleetDashboard();
    }

    @GetMapping("/bookings")
    @Operation(summary = "Bookings assigned to the fleet, filterable by status")
    public PageResponse<BookingResponse> bookings(@RequestParam(required = false) BookingStatus status,
                                                 @PageableDefault(size = 20, sort = "pickupDate",
                                                         direction = Sort.Direction.ASC) Pageable pageable) {
        return bookingService.search(status, null, null, null, null, null, pageable);
    }

    @GetMapping("/maintenance")
    @Operation(summary = "Maintenance records, newest schedules first")
    public PageResponse<MaintenanceResponse> maintenance(@PageableDefault(size = 20) Pageable pageable) {
        return maintenanceService.list(pageable);
    }

    @PostMapping("/vehicles/{vehicleId}/maintenance")
    @Operation(summary = "Schedule maintenance",
            description = "Takes the vehicle out of the bookable pool (status MAINTENANCE). Existing confirmed "
                    + "bookings are flagged with a notification rather than cancelled.")
    public ResponseEntity<MaintenanceResponse> schedule(@PathVariable Long vehicleId,
                                                        @Valid @RequestBody MaintenanceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceService.schedule(vehicleId, request));
    }

    @PostMapping("/maintenance/{id}/complete")
    @Operation(summary = "Complete maintenance",
            description = "Releases the vehicle back to AVAILABLE unless releaseVehicle=false.")
    public MaintenanceResponse complete(@PathVariable Long id,
                                        @RequestBody(required = false) @Valid MaintenanceCompleteRequest request) {
        return maintenanceService.complete(id, request);
    }

    @GetMapping("/vehicles/{vehicleId}/maintenance")
    @Operation(summary = "Maintenance history for one vehicle")
    public List<MaintenanceResponse> maintenanceForVehicle(@PathVariable Long vehicleId) {
        return maintenanceService.forVehicle(vehicleId);
    }

    @GetMapping("/damage")
    @Operation(summary = "Damage records across the fleet")
    public PageResponse<DamageResponse> damage(@PageableDefault(size = 20) Pageable pageable) {
        return damageService.list(pageable);
    }

    @PatchMapping("/damage/{id}")
    @Operation(summary = "Update a damage record (repair progress and actual cost)")
    public DamageResponse updateDamage(@PathVariable Long id, @Valid @RequestBody DamageStatusRequest request) {
        return damageService.updateStatus(id, request);
    }

    @GetMapping("/vehicles")
    @Operation(summary = "Fleet vehicle table, including non-bookable statuses")
    public PageResponse<VehicleResponse> vehicles(@RequestParam(required = false) String location,
                                                  @RequestParam(required = false) String search,
                                                  @PageableDefault(size = 20, sort = "make") Pageable pageable) {
        return vehicleService.search(null, null, location, null, null, null, null, null, null,
                search, null, true, pageable);
    }

    @GetMapping("/vehicles/{vehicleId}/history")
    @Operation(summary = "Merged vehicle timeline: rentals, maintenance and damage")
    public VehicleHistoryResponse history(@PathVariable Long vehicleId) {
        return vehicleHistoryService.history(vehicleId);
    }

    @GetMapping(value = "/vehicles/export", produces = "text/csv")
    @Operation(summary = "Export the fleet table as CSV", description = "RFC 4180 quoting, safe against formula injection.")
    public ResponseEntity<byte[]> exportFleet() {
        byte[] csv = vehicleService.exportFleetCsv().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"driveease-fleet.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/pickups")
    @Operation(summary = "Confirmed bookings due for hand-over at a given date")
    public PageResponse<BookingResponse> pickups(@RequestParam(required = false) LocalDate date,
                                                 @PageableDefault(size = 50) Pageable pageable) {
        return bookingService.search(BookingStatus.CONFIRMED, date == null ? LocalDate.now() : date, null,
                null, null, null, pageable);
    }

}

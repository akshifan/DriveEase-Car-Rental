package com.driveease.controller;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.payment.FleetRefundRequest;
import com.driveease.dto.payment.PaymentResponse;
import com.driveease.dto.payment.RefundResponse;
import com.driveease.dto.report.DashboardResponse;
import com.driveease.dto.report.FleetPaymentSummary;
import com.driveease.dto.vehicle.*;
import com.driveease.entity.BookingStatus;
import com.driveease.security.SecurityUtils;
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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * Fleet-owner workspace (PRD EPIC-05).
 *
 * <p>Both {@code FLEET_MANAGER} and {@code ADMIN} can own vehicles and take
 * bookings on them. Ownership is a property of the user, not the role: an admin
 * who adds vehicles is the owner of their own fleet ("fleet C"), and their
 * fleet console is scoped to that fleet exactly like any other fleet
 * partner's.</p>
 *
 * <p>Global administration lives under {@code /api/v1/admin/**}; this surface
 * is always scoped to the caller's own fleet, whoever they are.</p>
 */
@RestController
@RequestMapping("/api/v1/fleet")
@PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
@Tag(name = "Fleet", description = "Fleet-owner dashboard, bookings, payments, maintenance, damage and exports")
public class FleetController {

    private final DashboardService dashboardService;
    private final MaintenanceService maintenanceService;
    private final DamageService damageService;
    private final BookingService bookingService;
    private final VehicleService vehicleService;
    private final VehicleHistoryService vehicleHistoryService;
    private final PaymentService paymentService;
    private final RefundService refundService;

    public FleetController(DashboardService dashboardService,
                           MaintenanceService maintenanceService,
                           DamageService damageService,
                           BookingService bookingService,
                           VehicleService vehicleService,
                           VehicleHistoryService vehicleHistoryService,
                           PaymentService paymentService,
                           RefundService refundService) {
        this.dashboardService = dashboardService;
        this.maintenanceService = maintenanceService;
        this.damageService = damageService;
        this.bookingService = bookingService;
        this.vehicleService = vehicleService;
        this.vehicleHistoryService = vehicleHistoryService;
        this.paymentService = paymentService;
        this.refundService = refundService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Fleet overview scoped to the caller's own fleet")
    public DashboardResponse.FleetDashboard dashboard() {
        return dashboardService.fleetDashboard(SecurityUtils.requireUser());
    }

    @GetMapping("/bookings")
    @Operation(summary = "Bookings for the caller's own fleet only")
    public PageResponse<BookingResponse> bookings(@RequestParam(required = false) BookingStatus status,
                                                  @PageableDefault(size = 20, sort = "pickupDate",
                                                      direction = Sort.Direction.ASC) Pageable pageable) {
        return bookingService.fleetBookings(SecurityUtils.requireUser(), status, pageable);
    }

    @PostMapping("/bookings/{bookingId}/refund-deposit")
    @Operation(summary = "Refund a customer's deposit after a completed rental",
        description = """
                    Only the owning fleet can call this. Used when the rental completed with
                    damage: the fleet keeps the repair cost and returns the rest of the deposit.
                    Idempotent — a second call with the same amount returns the existing refund.
                    """)
    public RefundResponse refundDeposit(@PathVariable Long bookingId,
                                        @Valid @RequestBody FleetRefundRequest request) {
        return refundService.refundDepositByFleet(
            bookingId, request.amount(), request.reason(), SecurityUtils.requireUser());
    }

    @GetMapping("/payments")
    @Operation(summary = "Payments collected for the caller's own fleet")
    public PageResponse<PaymentResponse> payments(@PageableDefault(size = 20, sort = "createdAt",
        direction = Sort.Direction.DESC) Pageable pageable) {
        return paymentService.fleetPayments(SecurityUtils.requireUser(), pageable);
    }

    @GetMapping("/payments/summary")
    @Operation(summary = "Aggregated earnings for the caller's own fleet")
    public FleetPaymentSummary paymentsSummary() {
        return paymentService.fleetSummary(SecurityUtils.requireUser());
    }

    @GetMapping("/maintenance")
    public PageResponse<MaintenanceResponse> maintenance(@PageableDefault(size = 20) Pageable pageable) {
        return maintenanceService.list(SecurityUtils.requireUser(), pageable);
    }

    @PostMapping("/vehicles/{vehicleId}/maintenance")
    public ResponseEntity<MaintenanceResponse> schedule(@PathVariable Long vehicleId,
                                                        @Valid @RequestBody MaintenanceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(maintenanceService.schedule(vehicleId, request, SecurityUtils.requireUser()));
    }

    @PostMapping("/maintenance/{id}/complete")
    public MaintenanceResponse complete(@PathVariable Long id,
                                        @RequestBody(required = false) @Valid MaintenanceCompleteRequest request) {
        return maintenanceService.complete(id, request, SecurityUtils.requireUser());
    }

    @GetMapping("/vehicles/{vehicleId}/maintenance")
    public List<MaintenanceResponse> maintenanceForVehicle(@PathVariable Long vehicleId) {
        return maintenanceService.forVehicle(vehicleId, SecurityUtils.requireUser());
    }

    @GetMapping("/damage")
    public PageResponse<DamageResponse> damage(@PageableDefault(size = 20) Pageable pageable) {
        return damageService.list(SecurityUtils.requireUser(), pageable);
    }

    @PatchMapping("/damage/{id}")
    public DamageResponse updateDamage(@PathVariable Long id, @Valid @RequestBody DamageStatusRequest request) {
        return damageService.updateStatus(id, request, SecurityUtils.requireUser());
    }

    @GetMapping("/vehicles")
    @Operation(summary = "Fleet vehicle table scoped to the caller's own fleet")
    public PageResponse<VehicleResponse> vehicles(@RequestParam(required = false) String location,
                                                  @RequestParam(required = false) String search,
                                                  @PageableDefault(size = 20, sort = "make") Pageable pageable) {
        // Always scoped to the caller, whether they are a fleet manager or an
        // admin using their own fleet console. Global views live under /admin.
        return vehicleService.search(null, null, location, null, null, null, null, null, null,
            search, null, true, SecurityUtils.currentUserId(), pageable);
    }

    @GetMapping("/vehicles/{vehicleId}/history")
    public VehicleHistoryResponse history(@PathVariable Long vehicleId) {
        return vehicleHistoryService.history(vehicleId, SecurityUtils.requireUser());
    }

    @GetMapping(value = "/vehicles/export", produces = "text/csv")
    public ResponseEntity<byte[]> exportFleet() {
        byte[] csv = vehicleService.exportFleetCsv(SecurityUtils.requireUser())
            .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"driveease-fleet.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv);
    }

    @GetMapping("/pickups")
    public PageResponse<BookingResponse> pickups(@RequestParam(required = false) LocalDate date,
                                                 @PageableDefault(size = 50) Pageable pageable) {
        return bookingService.fleetBookings(SecurityUtils.requireUser(),
            BookingStatus.CONFIRMED, pageable);
    }
}

package com.driveease.controller;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.vehicle.*;
import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import com.driveease.entity.VehicleStatus;
import com.driveease.security.SecurityUtils;
import com.driveease.service.DamageService;
import com.driveease.service.VehicleHistoryService;
import com.driveease.service.VehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Vehicle catalogue and fleet vehicle management (PRD 5.3). */
@RestController
@RequestMapping("/api/v1/vehicles")
@Tag(name = "Vehicles", description = "Catalogue search, vehicle detail and fleet vehicle management")
public class VehicleController {

    private final VehicleService vehicleService;
    private final VehicleHistoryService historyService;
    private final DamageService damageService;

    public VehicleController(VehicleService vehicleService,
                             VehicleHistoryService historyService,
                             DamageService damageService) {
        this.vehicleService = vehicleService;
        this.historyService = historyService;
        this.damageService = damageService;
    }

    @GetMapping
    @SecurityRequirements
    @Operation(summary = "Search the fleet")
    public PageResponse<VehicleResponse> search(
        @RequestParam(required = false) LocalDate pickupDate,
        @RequestParam(required = false) LocalDate returnDate,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) VehicleCategory category,
        @RequestParam(required = false) FuelType fuelType,
        @RequestParam(required = false) Transmission transmission,
        @RequestParam(required = false) BigDecimal minPrice,
        @RequestParam(required = false) BigDecimal maxPrice,
        @RequestParam(required = false) Integer minSeats,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) VehicleStatus status,
        @RequestParam(required = false, defaultValue = "false") boolean includeUnavailable,
        @PageableDefault(size = 20, sort = "dailyRate", direction = Sort.Direction.ASC) Pageable pageable) {
        // Public catalogue: no owner filter. Staff console uses /fleet/vehicles.
        return vehicleService.search(pickupDate, returnDate, location, category, fuelType, transmission,
            minPrice, maxPrice, minSeats, search, status, includeUnavailable, null, pageable);
    }

    @GetMapping("/locations")
    @SecurityRequirements
    public List<String> locations() {
        return vehicleService.locations();
    }

    @GetMapping("/categories")
    @SecurityRequirements
    public List<Map<String, Object>> categories() {
        return vehicleService.categories();
    }

    @GetMapping("/{id}")
    @SecurityRequirements
    public VehicleDetailResponse detail(@PathVariable Long id,
                                        @RequestParam(required = false) LocalDate pickupDate,
                                        @RequestParam(required = false) LocalDate returnDate) {
        return vehicleService.detail(id, pickupDate, returnDate);
    }

    @GetMapping("/{id}/availability")
    @SecurityRequirements
    public PageResponse<BookingResponse> availability(@PathVariable Long id,
                                                      @PageableDefault(size = 20) Pageable pageable) {
        return vehicleService.availability(id, pageable);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Add a vehicle to the fleet")
    public ResponseEntity<VehicleResponse> create(@Valid @RequestBody VehicleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(vehicleService.create(request, SecurityUtils.requireUser()));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    public VehicleResponse update(@PathVariable Long id, @Valid @RequestBody VehicleUpdateRequest request) {
        return vehicleService.update(id, request, SecurityUtils.requireUser());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    public VehicleResponse changeStatus(@PathVariable Long id, @Valid @RequestBody VehicleStatusRequest request) {
        return vehicleService.changeStatus(id, request, SecurityUtils.requireUser());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> retire(@PathVariable Long id, @RequestParam String reason) {
        vehicleService.retire(id, reason, SecurityUtils.requireUser());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    public VehicleHistoryResponse history(@PathVariable Long id) {
        return historyService.history(id, SecurityUtils.requireUser());
    }

    @PostMapping("/{id}/damage")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    public ResponseEntity<DamageResponse> logDamage(@PathVariable Long id, @Valid @RequestBody DamageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(damageService.log(id, request, SecurityUtils.requireUser()));
    }

    @GetMapping("/{id}/damage")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    public List<DamageResponse> damage(@PathVariable Long id) {
        return damageService.forVehicle(id, SecurityUtils.requireUser());
    }
}

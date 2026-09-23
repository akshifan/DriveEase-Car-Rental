package com.driveease.controller;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.vehicle.*;
import com.driveease.entity.FuelType;
import com.driveease.entity.Transmission;
import com.driveease.entity.VehicleCategory;
import com.driveease.entity.VehicleStatus;
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
    @Operation(summary = "Search the fleet",
            description = """
                    Server-side filtering, sorting and pagination. Supplying `pickupDate` and `returnDate`
                    excludes every vehicle that already has a PENDING/CONFIRMED/ACTIVE booking overlapping
                    the window - the availability answer is authoritative and produced by the database.

                    Default sort is `dailyRate,asc`; `sort` accepts any vehicle field, e.g. `sort=dailyRate,desc`.
                    """)
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
        return vehicleService.search(pickupDate, returnDate, location, category, fuelType, transmission,
                minPrice, maxPrice, minSeats, search, status, includeUnavailable, pageable);
    }

    @GetMapping("/locations")
    @SecurityRequirements
    @Operation(summary = "Distinct pickup locations in the active fleet")
    public List<String> locations() {
        return vehicleService.locations();
    }

    @GetMapping("/categories")
    @SecurityRequirements
    @Operation(summary = "Category rollup for the catalogue filter rail",
            description = "Vehicle count and cheapest daily rate per category, aggregated in the database.")
    public List<Map<String, Object>> categories() {
        return vehicleService.categories();
    }

    @GetMapping("/{id}")
    @SecurityRequirements
    @Operation(summary = "Vehicle detail with specs, gallery, ratings and availability windows")
    public VehicleDetailResponse detail(@PathVariable Long id,
                                        @RequestParam(required = false) LocalDate pickupDate,
                                        @RequestParam(required = false) LocalDate returnDate) {
        return vehicleService.detail(id, pickupDate, returnDate);
    }

    @GetMapping("/{id}/availability")
    @SecurityRequirements
    @Operation(summary = "Booked windows for a vehicle (used by the date picker)")
    public PageResponse<BookingResponse> availability(@PathVariable Long id,
                                                     @PageableDefault(size = 20) Pageable pageable) {
        return vehicleService.availability(id, pageable);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Add a vehicle to the fleet")
    public ResponseEntity<VehicleResponse> create(@Valid @RequestBody VehicleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vehicleService.create(request));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Partially update a vehicle",
            description = "Every field is optional. Status changes are validated against the vehicle state machine.")
    public VehicleResponse update(@PathVariable Long id, @Valid @RequestBody VehicleUpdateRequest request) {
        return vehicleService.update(id, request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Move a vehicle through its status machine",
            description = "AVAILABLE -> RENTED/MAINTENANCE/RETIRED, RENTED -> AVAILABLE/MAINTENANCE, "
                    + "MAINTENANCE -> AVAILABLE/RETIRED. RETIRED is terminal and requires a reason.")
    public VehicleResponse changeStatus(@PathVariable Long id, @Valid @RequestBody VehicleStatusRequest request) {
        return vehicleService.changeStatus(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Retire a vehicle (soft delete)",
            description = "Requires a reason; existing bookings are honoured, the vehicle disappears from search.")
    public ResponseEntity<Void> retire(@PathVariable Long id, @RequestParam String reason) {
        vehicleService.retire(id, reason);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Merged vehicle history: rentals, maintenance and damage")
    public VehicleHistoryResponse history(@PathVariable Long id) {
        return historyService.history(id);
    }

    @PostMapping("/{id}/damage")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Log damage found on a vehicle",
            description = "CRITICAL damage automatically parks the vehicle in MAINTENANCE.")
    public ResponseEntity<DamageResponse> logDamage(@PathVariable Long id, @Valid @RequestBody DamageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(damageService.log(id, request));
    }

    @GetMapping("/{id}/damage")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Damage records for a vehicle")
    public List<DamageResponse> damage(@PathVariable Long id) {
        return damageService.forVehicle(id);
    }
}

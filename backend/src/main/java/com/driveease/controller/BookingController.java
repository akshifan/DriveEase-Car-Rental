package com.driveease.controller;

import com.driveease.dto.booking.*;
import com.driveease.dto.common.PageResponse;
import com.driveease.entity.BookingStatus;
import com.driveease.security.SecurityUtils;
import com.driveease.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Booking engine endpoints (PRD 5.4, EPIC-03). */
@RestController
@RequestMapping("/api/v1/bookings")
@Tag(name = "Bookings", description = "Reservation lifecycle: create, view, cancel and the fleet pickup/return workflow")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    @Operation(summary = "Create a booking (PENDING)",
            description = """
                    Validates the requested window against existing PENDING/CONFIRMED/ACTIVE bookings for the
                    same vehicle, prices the rental server side and stores a PENDING booking. The vehicle stays
                    AVAILABLE until the physical pickup.

                    Returns **409 VEHICLE_NOT_AVAILABLE** when the dates overlap an existing reservation.
                    """)
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Booking created")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Dates overlap an existing booking")
    public ResponseEntity<BookingDetailResponse> create(@Valid @RequestBody BookingCreateRequest request) {
        BookingDetailResponse response = bookingService.create(SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/quote")
    @Operation(summary = "Price a rental without creating a booking",
            description = "Returns days, base amount, deposit and total, computed by the PricingService.")
    public PriceQuotePreview quote(@Valid @RequestBody PriceQuoteRequest request) {
        var pricing = bookingService.quote(request);
        return new PriceQuotePreview(pricing.totalDays(), pricing.dailyRate(), pricing.baseAmount(),
                pricing.depositAmount(), pricing.totalAmount(), pricing.currency());
    }

    @GetMapping
    @Operation(summary = "Bookings belonging to the authenticated customer")
    public PageResponse<BookingResponse> mine(@PageableDefault(size = 10, sort = "pickupDate",
            direction = Sort.Direction.DESC) Pageable pageable) {
        return bookingService.myBookings(SecurityUtils.currentUserId(), pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Full booking detail with itemised costs, payments and review")
    public BookingDetailResponse detail(@PathVariable Long id) {
        return bookingService.detail(id, SecurityUtils.requireUser());
    }

    @GetMapping("/reference/{reference}")
    @Operation(summary = "Booking detail by business reference (e.g. DE-20261010-4821)")
    public BookingDetailResponse detailByReference(@PathVariable String reference) {
        return bookingService.detailByReference(reference, SecurityUtils.requireUser());
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a PENDING or CONFIRMED booking",
            description = "Paid bookings are refunded automatically: the deposit is always returned, "
                    + "the rental fee is returned when cancelling more than 24h before pickup.")
    public BookingDetailResponse cancel(@PathVariable Long id,
                                        @Valid @RequestBody BookingCancellationRequest request) {
        return bookingService.cancel(id, SecurityUtils.requireUser(), request.reason());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
    @Operation(summary = "Fleet workflow transition",
            description = "PENDING -> CONFIRMED (manual confirmation), CONFIRMED -> ACTIVE (pickup, vehicle becomes "
                    + "RENTED) and ACTIVE -> COMPLETED (return, vehicle becomes AVAILABLE). "
                    + "Any other transition is rejected with 409 INVALID_BOOKING_STATE.")
    public BookingDetailResponse updateStatus(@PathVariable Long id,
                                              @Valid @RequestBody BookingStatusUpdateRequest request) {
        return bookingService.updateStatus(id, request, SecurityUtils.requireUser());
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "All bookings with admin filters (status, dates, vehicle, customer, free text)")
    public PageResponse<BookingResponse> all(@RequestParam(required = false) BookingStatus status,
                                             @RequestParam(required = false) LocalDate startDate,
                                             @RequestParam(required = false) LocalDate endDate,
                                             @RequestParam(required = false) Long vehicleId,
                                             @RequestParam(required = false) Long userId,
                                             @RequestParam(required = false) String search,
                                             @PageableDefault(size = 20, sort = "createdAt",
                                                     direction = Sort.Direction.DESC) Pageable pageable) {
        return bookingService.search(status, startDate, endDate, vehicleId, userId, search, pageable);
    }

    /** Quote payload for the booking wizard price preview. */
    public record PriceQuotePreview(int totalDays, java.math.BigDecimal dailyRate, java.math.BigDecimal baseAmount,
                                    java.math.BigDecimal depositAmount, java.math.BigDecimal totalAmount,
                                    String currency) {
    }
}

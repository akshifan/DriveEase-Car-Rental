package com.driveease.controller;

import com.driveease.dto.common.MessageResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.review.ReviewCreateRequest;
import com.driveease.dto.review.ReviewModerationRequest;
import com.driveease.dto.review.ReviewResponse;
import com.driveease.dto.review.VehicleRatingSummary;
import com.driveease.security.SecurityUtils;
import com.driveease.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reviews and moderation (PRD 5.6, EPIC-06). */
@RestController
@RequestMapping("/api/v1/reviews")
@Tag(name = "Reviews", description = "Vehicle reviews: submission, public listings and admin moderation")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    @Operation(summary = "Review a completed rental",
            description = "One review per booking, only for the customer's own COMPLETED rental. "
                    + "Rating 1-5, comment optional up to 1000 characters.")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Review stored")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Already reviewed")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Rental not completed")
    public ResponseEntity<ReviewResponse> create(@Valid @RequestBody ReviewCreateRequest request) {
        ReviewResponse response = reviewService.create(SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/vehicle/{vehicleId}")
    @SecurityRequirements
    @Operation(summary = "Public reviews for a vehicle, newest first",
            description = "Reviewer identity is limited to a first name and initials - no contact details.")
    public PageResponse<ReviewResponse> forVehicle(@PathVariable Long vehicleId,
                                                  @PageableDefault(size = 10) Pageable pageable) {
        return reviewService.forVehicle(vehicleId, pageable);
    }

    @GetMapping("/summary/{vehicleId}")
    @SecurityRequirements
    @Operation(summary = "Average rating, review count and star distribution for a vehicle")
    public VehicleRatingSummary summary(@PathVariable Long vehicleId) {
        return reviewService.summary(vehicleId);
    }

    @GetMapping("/booking/{bookingId}")
    @Operation(summary = "Review (if any) belonging to a booking")
    public List<ReviewResponse> forBooking(@PathVariable Long bookingId) {
        return reviewService.forBooking(bookingId, SecurityUtils.requireUser());
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Moderation queue with search, rating and vehicle filters")
    public PageResponse<ReviewResponse> all(@RequestParam(required = false) String search,
                                            @RequestParam(required = false) Integer maxRating,
                                            @RequestParam(required = false) Long vehicleId,
                                            @RequestParam(required = false, defaultValue = "true") boolean includeDeleted,
                                            @PageableDefault(size = 20) Pageable pageable) {
        return reviewService.search(search, maxRating, vehicleId, includeDeleted, pageable);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete a review (admin moderation)",
            description = "A reason is required and the action is written to the audit trail.")
    public MessageResponse moderate(@PathVariable Long id, @Valid @RequestBody ReviewModerationRequest request) {
        reviewService.moderate(id, request.reason(), SecurityUtils.requireUser());
        return new MessageResponse("Review removed from public listings.");
    }
}

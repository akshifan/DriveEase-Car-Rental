package com.driveease.controller;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.payment.*;
import com.driveease.entity.PaymentStatus;
import com.driveease.security.SecurityUtils;
import com.driveease.service.PaymentService;
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

import java.time.LocalDateTime;
import java.util.List;

/**
 * Payment endpoints (PRD 5.5, EPIC-04).
 *
 * <p><strong>Sandbox only:</strong> no real money is moved and no card data is stored.
 * The gateway simulates approvals and declines; see the sandbox rules in the API docs.</p>
 */
@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "Payments", description = "Sandbox payment capture, receipts and administrative refunds")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    @Operation(summary = "Pay for a pending booking",
            description = """
                    Sandbox gateway rules: amounts above the configured sandbox limit, card reference `0000`
                    or a UPI handle containing "fail" are declined (the booking then stays PENDING).
                    On success the payment becomes SUCCESS and the booking moves PENDING -> CONFIRMED.

                    Only the last four digits of a card may be supplied; full card numbers and CVVs are rejected.
                    """)
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Payment processed")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Booking already paid, cancelled or declined")
    public ResponseEntity<PaymentResponse> pay(@Valid @RequestBody PaymentCreateRequest request) {
        PaymentResponse response = paymentService.pay(SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Payment history of the authenticated customer")
    public PageResponse<PaymentResponse> mine(@PageableDefault(size = 10, sort = "createdAt",
            direction = Sort.Direction.DESC) Pageable pageable) {
        return paymentService.myPayments(SecurityUtils.currentUserId(), pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Payment detail with receipt summary and refund history")
    public PaymentDetailResponse detail(@PathVariable Long id) {
        return paymentService.detail(id, SecurityUtils.requireUser());
    }

    @GetMapping("/booking/{bookingId}")
    @Operation(summary = "Payments recorded against a booking")
    public List<PaymentResponse> forBooking(@PathVariable Long bookingId) {
        return paymentService.forBooking(bookingId);
    }

    @PostMapping("/{id}/refund")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Refund a payment (full or partial, admin only)",
            description = """
                    Validates that the refund never exceeds the collected amount or the remaining balance,
                    records the actor, the reason and the source (ADMIN), and marks the payment REFUNDED once
                    the full amount has been returned. A cancelled booking is refunded automatically instead.
                    """)
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Refund recorded")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Refund exceeds the refundable balance")
    public RefundResponse refund(@PathVariable Long id, @Valid @RequestBody RefundRequest request) {
        return paymentService.refund(id, request);
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "All payments with status, reference and date filters")
    public PageResponse<PaymentResponse> all(@RequestParam(required = false) PaymentStatus status,
                                            @RequestParam(required = false) String reference,
                                            @RequestParam(required = false) LocalDateTime from,
                                            @RequestParam(required = false) LocalDateTime to,
                                            @PageableDefault(size = 20, sort = "createdAt",
                                                    direction = Sort.Direction.DESC) Pageable pageable) {
        return paymentService.search(status, reference, from, to, pageable);
    }

    @GetMapping("/admin/refunds")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Refund ledger across all payments")
    public PageResponse<RefundResponse> refunds(@PageableDefault(size = 20) Pageable pageable) {
        return paymentService.refunds(pageable);
    }
}

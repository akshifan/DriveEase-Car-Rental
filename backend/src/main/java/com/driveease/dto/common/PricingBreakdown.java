package com.driveease.dto.common;

import java.math.BigDecimal;

/** Deterministic money breakdown produced by the PricingService. */
public record PricingBreakdown(
        int totalDays,
        BigDecimal dailyRate,
        BigDecimal baseAmount,
        BigDecimal depositAmount,
        BigDecimal totalAmount,
        String currency
) {
}

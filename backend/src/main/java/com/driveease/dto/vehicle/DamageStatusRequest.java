package com.driveease.dto.vehicle;

import com.driveease.entity.DamageStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DamageStatusRequest(
        @NotNull DamageStatus status,
        @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal actualRepairCost
) {
}

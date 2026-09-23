package com.driveease.service;

import com.driveease.config.AppProperties;
import com.driveease.dto.common.PricingBreakdown;
import com.driveease.entity.Vehicle;
import com.driveease.exception.InvalidRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The pricing engine is money-critical: it must be deterministic, BigDecimal-based
 * and must reject impossible windows.
 */
class PricingServiceTest {

    private PricingService pricingService;
    private Vehicle vehicle;

    @BeforeEach
    void setUp() {
        AppProperties properties = new AppProperties();
        properties.getBooking().setMinRentalDays(1);
        properties.getBooking().setMaxRentalDays(60);
        properties.getBooking().setMaxAdvanceDays(180);
        pricingService = new PricingService(properties);

        vehicle = new Vehicle();
        vehicle.setDailyRate(new BigDecimal("4250.00"));
        vehicle.setDepositAmount(new BigDecimal("15000.00"));
    }

    @Test
    @DisplayName("quote multiplies the daily rate by the half-open rental window")
    void quoteComputesBaseAmountAndDeposit() {
        LocalDate pickup = LocalDate.now().plusDays(10);
        LocalDate drop = pickup.plusDays(4);

        PricingBreakdown quote = pricingService.quote(vehicle, pickup, drop);

        assertThat(quote.totalDays()).isEqualTo(4);
        assertThat(quote.baseAmount()).isEqualByComparingTo("17000.00");
        assertThat(quote.depositAmount()).isEqualByComparingTo("15000.00");
        assertThat(quote.totalAmount()).isEqualByComparingTo("32000.00");
        assertThat(quote.dailyRate()).isEqualByComparingTo("4250.00");
    }

    @Test
    @DisplayName("a same-day pickup/return is rejected: the window is half-open")
    void rejectsZeroLengthRental() {
        LocalDate day = LocalDate.now().plusDays(3);
        assertThatThrownBy(() -> pricingService.quote(vehicle, day, day))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("return date must be after");
    }

    @Test
    @DisplayName("pickup dates in the past are rejected")
    void rejectsPastPickup() {
        assertThatThrownBy(() -> pricingService.quote(vehicle, LocalDate.now().minusDays(1), LocalDate.now().plusDays(2)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("cannot be in the past");
    }

    @Test
    @DisplayName("rentals longer than the configured maximum are rejected")
    void rejectsTooLongRental() {
        LocalDate pickup = LocalDate.now().plusDays(1);
        assertThatThrownBy(() -> pricingService.quote(vehicle, pickup, pickup.plusDays(90)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("maximum rental duration");
    }

    @Test
    @DisplayName("money is always normalised to two decimals")
    void roundsMoneyToTwoDecimals() {
        assertThat(PricingService.money(new BigDecimal("1234.567"))).isEqualByComparingTo("1234.57");
        assertThat(PricingService.money(new BigDecimal("100"))).isEqualByComparingTo("100.00");
        assertThat(PricingService.money(null)).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("early cancellation refunds the full amount paid")
    void refundsEverythingWhenCancelledEarly() {
        BigDecimal refundable = pricingService.refundableAmount(new BigDecimal("32000.00"),
                BigDecimal.ZERO, new BigDecimal("4250.00"), 5);
        assertThat(refundable).isEqualByComparingTo("32000.00");
    }

    @Test
    @DisplayName("late cancellation retains one day of rental but still returns the deposit")
    void retainsOneDayOnLateCancellation() {
        // 32,000 paid (17,000 rental + 15,000 deposit) - 4,250 late fee = 27,750
        BigDecimal refundable = pricingService.refundableAmount(new BigDecimal("32000.00"),
                BigDecimal.ZERO, new BigDecimal("4250.00"), 0);
        assertThat(refundable).isEqualByComparingTo("27750.00");
    }

    @Test
    @DisplayName("an already refunded amount is deducted from the remaining balance")
    void deductsPreviouslyRefundedAmounts() {
        BigDecimal refundable = pricingService.refundableAmount(new BigDecimal("32000.00"),
                new BigDecimal("12000.00"), new BigDecimal("4250.00"), 3);
        assertThat(refundable).isEqualByComparingTo("20000.00");
    }

    @Test
    @DisplayName("a refund can never exceed what was actually paid")
    void neverRefundsMoreThanPaid() {
        BigDecimal refundable = pricingService.refundableAmount(new BigDecimal("5000.00"),
                BigDecimal.ZERO, new BigDecimal("4250.00"), 5);
        assertThat(refundable).isEqualByComparingTo("5000.00");
    }

    @Test
    @DisplayName("nothing is refunded when nothing was paid, and a late fee cannot go negative")
    void refundsZeroWithoutPayment() {
        assertThat(pricingService.refundableAmount(BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("4250.00"), 0)).isEqualByComparingTo("0.00");
        assertThat(pricingService.refundableAmount(new BigDecimal("3000.00"), BigDecimal.ZERO,
                new BigDecimal("4250.00"), 0)).isEqualByComparingTo("0.00");
    }
}

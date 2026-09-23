package com.driveease.service;

import com.driveease.config.AppProperties;
import com.driveease.dto.common.PricingBreakdown;
import com.driveease.entity.Vehicle;
import com.driveease.exception.InvalidRequestException;
import com.driveease.util.DateUtils;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Single source of truth for rental money.
 *
 * <pre>
 * totalDays    = returnDate - pickupDate            (half-open: a 10th -> 14th rental is 4 days)
 * baseAmount   = dailyRate x totalDays
 * depositAmount= vehicle.depositAmount              (refundable security deposit)
 * totalAmount  = baseAmount + depositAmount         (amount collected at checkout)
 * </pre>
 *
 * All arithmetic uses BigDecimal with HALF_UP at scale 2 - never double/float.
 * The frontend also displays a quote, but only this service's numbers are
 * persisted on the booking.
 */
@Service
public class PricingService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final int SCALE = 2;

    private final AppProperties properties;

    public PricingService(AppProperties properties) {
        this.properties = properties;
    }

    public PricingBreakdown quote(Vehicle vehicle, LocalDate pickupDate, LocalDate returnDate) {
        validateWindow(pickupDate, returnDate);
        int days = DateUtils.rentalDays(pickupDate, returnDate);
        return quoteForDays(vehicle, days);
    }

    public PricingBreakdown quoteForDays(Vehicle vehicle, int days) {
        if (vehicle == null) {
            throw new InvalidRequestException("A vehicle is required to price a rental.");
        }
        if (days < properties.getBooking().getMinRentalDays() || days > properties.getBooking().getMaxRentalDays()) {
            throw InvalidRequestException.unprocessable("INVALID_RENTAL_DURATION",
                    "Rental duration must be between %d and %d days."
                            .formatted(properties.getBooking().getMinRentalDays(), properties.getBooking().getMaxRentalDays()));
        }
        BigDecimal dailyRate = money(vehicle.getDailyRate());
        BigDecimal baseAmount = money(dailyRate.multiply(BigDecimal.valueOf(days)));
        BigDecimal deposit = money(vehicle.getDepositAmount() == null ? ZERO : vehicle.getDepositAmount());
        BigDecimal total = money(baseAmount.add(deposit));
        return new PricingBreakdown(days, dailyRate, baseAmount, deposit, total, "INR");
    }

    /**
     * Cancellation policy - the single source of truth used by RefundService.
     *
     * <ul>
     *   <li>the security deposit is always returned;</li>
     *   <li>the rental fee is refunded in full when cancelling at least 24h before pickup;</li>
     *   <li>inside 24h, one day of rental is retained as a late-cancellation fee;</li>
     *   <li>a refund never exceeds what is still unrefunded, and never goes negative.</li>
     * </ul>
     *
     * @param paidAmount      total collected for the booking
     * @param alreadyRefunded amount already returned
     * @param dailyRate       vehicle daily rate (used for the late-cancellation fee)
     * @param daysUntilPickup whole days between today and the pickup date
     */
    public BigDecimal refundableAmount(BigDecimal paidAmount, BigDecimal alreadyRefunded,
                                       BigDecimal dailyRate, int daysUntilPickup) {
        if (paidAmount == null || paidAmount.compareTo(ZERO) <= 0) {
            return ZERO;
        }
        BigDecimal remaining = money(paidAmount.subtract(alreadyRefunded == null ? ZERO : alreadyRefunded));
        if (remaining.compareTo(ZERO) <= 0) {
            return ZERO;
        }
        if (daysUntilPickup >= 1) {
            return remaining;
        }
        BigDecimal lateFee = money(dailyRate == null ? ZERO : dailyRate).min(remaining);
        return money(remaining.subtract(lateFee).max(ZERO));
    }

    private void validateWindow(LocalDate pickupDate, LocalDate returnDate) {
        if (pickupDate == null || returnDate == null) {
            throw new InvalidRequestException("Pickup and return dates are required.");
        }
        if (!returnDate.isAfter(pickupDate)) {
            throw InvalidRequestException.unprocessable("INVALID_DATE_RANGE",
                    "The return date must be after the pickup date.");
        }
        if (pickupDate.isBefore(LocalDate.now())) {
            throw InvalidRequestException.unprocessable("PICKUP_IN_THE_PAST", "The pickup date cannot be in the past.");
        }
        int days = DateUtils.rentalDays(pickupDate, returnDate);
        if (days < properties.getBooking().getMinRentalDays()) {
            throw InvalidRequestException.unprocessable("INVALID_RENTAL_DURATION",
                    "The minimum rental duration is " + properties.getBooking().getMinRentalDays() + " day(s).");
        }
        if (days > properties.getBooking().getMaxRentalDays()) {
            throw InvalidRequestException.unprocessable("INVALID_RENTAL_DURATION",
                    "The maximum rental duration is " + properties.getBooking().getMaxRentalDays() + " days.");
        }
        if (pickupDate.isAfter(LocalDate.now().plusDays(properties.getBooking().getMaxAdvanceDays()))) {
            throw InvalidRequestException.unprocessable("BOOKING_TOO_FAR_AHEAD",
                    "Bookings open at most " + properties.getBooking().getMaxAdvanceDays() + " days in advance.");
        }
    }

    public static BigDecimal money(BigDecimal value) {
        return value == null ? ZERO : value.setScale(SCALE, RoundingMode.HALF_UP);
    }
}

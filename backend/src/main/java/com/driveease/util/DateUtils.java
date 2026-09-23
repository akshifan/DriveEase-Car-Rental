package com.driveease.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public final class DateUtils {

    private DateUtils() {
    }

    /** Rental days on the half-open interval [pickup, return). */
    public static int rentalDays(LocalDate pickupDate, LocalDate returnDate) {
        return (int) ChronoUnit.DAYS.between(pickupDate, returnDate);
    }

    public static boolean rangesOverlap(LocalDate startA, LocalDate endA, LocalDate startB, LocalDate endB) {
        return startA.isBefore(endB) && startB.isBefore(endA);
    }

    public static long daysBetweenInclusive(LocalDate from, LocalDate to) {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }
}

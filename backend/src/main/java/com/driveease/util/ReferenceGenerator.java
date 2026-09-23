package com.driveease.util;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Human friendly, collision-resistant business references:
 * booking {@code DE-20261010-4821}, payment {@code DE-PAY-20261010-4821},
 * refund {@code DE-RF-20261010-4821}.
 */
@Component
public class ReferenceGenerator {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final AtomicInteger SEQUENCE = new AtomicInteger(RANDOM.nextInt(1000));

    public String bookingReference(LocalDate pickupDate) {
        return "%s-%s-%04d".formatted("DE", date(pickupDate), next());
    }

    public String paymentReference(LocalDate bookingDate) {
        return "%s-%s-%s-%04d".formatted("DE", "PAY", date(bookingDate), next());
    }

    public String refundReference(LocalDate date) {
        return "%s-%s-%s-%04d".formatted("DE", "RF", date(date), next());
    }

    private String date(LocalDate date) {
        return (date == null ? LocalDate.now() : date).format(DATE);
    }

    private int next() {
        return Math.floorMod(SEQUENCE.incrementAndGet(), 10000);
    }

    /** Simulated gateway reference for the sandbox payment provider. */
    public String gatewayTransactionRef(String prefix) {
        return "%s-%08X".formatted(prefix, RANDOM.nextInt(Integer.MAX_VALUE));
    }
}

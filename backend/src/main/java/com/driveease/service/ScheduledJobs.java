package com.driveease.service;

import com.driveease.entity.Booking;
import com.driveease.entity.BookingStatus;
import com.driveease.entity.NotificationType;
import com.driveease.repository.BookingRepository;
import com.driveease.security.RefreshTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Housekeeping jobs.
 *
 * <ul>
 *   <li>purge expired/revoked refresh tokens daily (keeps the token table small);</li>
 *   <li>remind customers whose rental is due back tomorrow;</li>
 *   <li>flag overdue rentals to fleet managers once a day.</li>
 * </ul>
 */
@Component
public class ScheduledJobs {

    private static final Logger log = LoggerFactory.getLogger(ScheduledJobs.class);

    private final RefreshTokenService refreshTokenService;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    public ScheduledJobs(RefreshTokenService refreshTokenService,
                         BookingRepository bookingRepository,
                         NotificationService notificationService) {
        this.refreshTokenService = refreshTokenService;
        this.bookingRepository = bookingRepository;
        this.notificationService = notificationService;
    }

    /** 03:15 every day. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        int removed = refreshTokenService.purgeExpired();
        if (removed > 0) {
            log.info("Purged {} expired refresh token(s)", removed);
        }
    }

    /** 07:00 every day - "your car is due back tomorrow". */
    @Scheduled(cron = "0 0 7 * * *")
    @Transactional
    public void sendReturnReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        List<Booking> dueTomorrow = bookingRepository.findUpcomingWithVehicle(LocalDate.now(),
                org.springframework.data.domain.PageRequest.of(0, 500)).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.ACTIVE)
                .filter(booking -> booking.getReturnDate().equals(tomorrow))
                .toList();

        dueTomorrow.forEach(booking -> notificationService.notifyUser(booking.getUser().getId(),
            NotificationType.BOOKING_ACTIVE,
            "Return reminder - " + booking.getBookingReference(),
            "The " + booking.getVehicle().displayName() + " is due back tomorrow at "
                + booking.getReturnLocation() + ".",
            "/bookings/" + booking.getId()));

        if (!dueTomorrow.isEmpty()) {
            log.info("Sent {} return reminder(s)", dueTomorrow.size());
        }
    }

    /** 06:00 every day - overdue rentals are surfaced to operations. */
    @Scheduled(cron = "0 0 6 * * *")
    @Transactional
    public void flagOverdueRentals() {
        LocalDate today = LocalDate.now();
        List<Booking> overdue = bookingRepository.findUpcomingWithVehicle(today.minusDays(30),
                org.springframework.data.domain.PageRequest.of(0, 500)).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.ACTIVE)
                .filter(booking -> booking.getReturnDate().isBefore(today))
                .toList();

        overdue.forEach(booking -> {
            log.warn("Overdue rental {} - vehicle {} was due on {}",
                booking.getBookingReference(), booking.getVehicle().getLicensePlate(), booking.getReturnDate());
            notificationService.notifyUser(booking.getUser().getId(), NotificationType.BOOKING_ACTIVE,
                "Your rental is overdue - " + booking.getBookingReference(),
                "The " + booking.getVehicle().displayName() + " was due back on " + booking.getReturnDate()
                    + ". Please contact the pickup branch.",
                "/bookings/" + booking.getId());
        });
    }
}

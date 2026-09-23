package com.driveease.service;

import com.driveease.entity.Booking;
import com.driveease.entity.BookingStatus;
import com.driveease.entity.PaymentStatus;
import com.driveease.repository.BookingRepository;
import com.driveease.repository.PaymentRepository;
import com.driveease.repository.spec.BookingSpecifications;
import com.driveease.util.CsvWriter;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * CSV export for the admin booking overview (PRD US-03-07).
 * Values go through {@link CsvWriter}, so commas, quotes and newlines inside
 * customer supplied data are escaped instead of corrupting the file.
 */
@Service
public class BookingExportService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;

    public BookingExportService(BookingRepository bookingRepository, PaymentRepository paymentRepository) {
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
    }

    private static final List<String> HEADERS = List.of(
            "Booking Reference", "Customer", "Customer Email", "Vehicle", "License Plate", "Category",
            "Pickup Date", "Return Date", "Days", "Pickup Location", "Return Location",
            "Booking Status", "Payment Status", "Base Amount", "Deposit", "Total Amount", "Created At");

    @Transactional(readOnly = true)
    public String export(BookingStatus status, LocalDate startDate, LocalDate endDate,
                         Long vehicleId, Long userId, String search) {
        Specification<Booking> spec = Specification.allOf(
                BookingSpecifications.hasStatus(status),
                BookingSpecifications.fromDate(startDate),
                BookingSpecifications.toDate(endDate),
                BookingSpecifications.forVehicle(vehicleId),
                BookingSpecifications.forUser(userId),
                BookingSpecifications.referenceOrCustomer(search));

        List<Booking> bookings = bookingRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<List<?>> rows = new ArrayList<>(bookings.size());
        for (Booking booking : bookings) {
            rows.add(List.of(
                    booking.getBookingReference(),
                    booking.getUser().fullName(),
                    booking.getUser().getEmail(),
                    booking.getVehicle().displayName(),
                    booking.getVehicle().getLicensePlate(),
                    booking.getVehicle().getCategory(),
                    booking.getPickupDate(),
                    booking.getReturnDate(),
                    booking.getTotalDays(),
                    booking.getPickupLocation(),
                    booking.getReturnLocation(),
                    booking.getStatus(),
                    resolvePaymentStatus(booking.getId()),
                    booking.getBaseAmount(),
                    booking.getDepositAmount(),
                    booking.getTotalAmount(),
                    booking.getCreatedAt()));
        }
        return CsvWriter.write(HEADERS, rows);
    }

    private String resolvePaymentStatus(Long bookingId) {
        List<com.driveease.entity.Payment> payments = paymentRepository.findByBookingId(bookingId);
        if (payments.isEmpty()) {
            return "UNPAID";
        }
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.SUCCESS)) {
            return PaymentStatus.SUCCESS.name();
        }
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.REFUNDED)) {
            return PaymentStatus.REFUNDED.name();
        }
        if (payments.stream().anyMatch(p -> p.getStatus() == PaymentStatus.PENDING)) {
            return PaymentStatus.PENDING.name();
        }
        return PaymentStatus.FAILED.name();
    }
}

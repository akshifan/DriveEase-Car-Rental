package com.driveease.mapper;

import com.driveease.dto.booking.BookingCustomerSummary;
import com.driveease.dto.booking.BookingResponse;
import com.driveease.entity.Booking;
import com.driveease.entity.PaymentStatus;
import org.springframework.stereotype.Component;

@Component
public class BookingMapper {

    private final VehicleMapper vehicleMapper;

    public BookingMapper(VehicleMapper vehicleMapper) {
        this.vehicleMapper = vehicleMapper;
    }

    public BookingResponse toResponse(Booking booking, PaymentStatus paymentStatus, boolean reviewed) {
        if (booking == null) {
            return null;
        }
        return new BookingResponse(
                booking.getId(),
                booking.getBookingReference(),
                vehicleMapper.toSummary(booking.getVehicle()),
                booking.getPickupDate(),
                booking.getReturnDate(),
                booking.getPickupLocation(),
                booking.getReturnLocation(),
                booking.getTotalDays(),
                booking.getBaseAmount(),
                booking.getDepositAmount(),
                booking.getTotalAmount(),
                booking.getStatus(),
                paymentStatus,
                booking.getStatus().isCancellable(),
                booking.getStatus() == com.driveease.entity.BookingStatus.COMPLETED && !reviewed,
                reviewed,
                booking.getCreatedAt());
    }

    public BookingCustomerSummary toCustomerSummary(Booking booking) {
        var user = booking.getUser();
        return new BookingCustomerSummary(user.getId(), user.fullName(), user.getEmail(), user.getPhone(), user.initials());
    }
}

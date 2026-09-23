package com.driveease.exception;

import com.driveease.entity.BookingStatus;
import org.springframework.http.HttpStatus;

/** 409 - an illegal lifecycle transition was requested. */
public class InvalidBookingStateException extends ApiException {

    public InvalidBookingStateException(String message) {
        super(HttpStatus.CONFLICT, "INVALID_BOOKING_STATE", message);
    }

    public static InvalidBookingStateException transition(BookingStatus from, BookingStatus to) {
        return new InvalidBookingStateException(
                "Booking cannot move from " + from + " to " + to + ".");
    }
}

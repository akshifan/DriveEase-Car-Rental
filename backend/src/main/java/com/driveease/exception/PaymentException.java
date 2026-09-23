package com.driveease.exception;

import org.springframework.http.HttpStatus;

public class PaymentException extends ApiException {

    public PaymentException(String message) {
        super(HttpStatus.CONFLICT, "PAYMENT_DECLINED", message);
    }

    public PaymentException(String code, String message, HttpStatus status) {
        super(status, code, message);
    }

    public static PaymentException alreadyPaid(String bookingReference) {
        return new PaymentException("PAYMENT_ALREADY_SETTLED",
                "Booking " + bookingReference + " has already been paid.", HttpStatus.CONFLICT);
    }
}

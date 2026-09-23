package com.driveease.exception;

import org.springframework.http.HttpStatus;

import java.time.LocalDate;

/** 409 - the requested window clashes with an existing reservation (PRD US-03-01). */
public class BookingConflictException extends ApiException {

    public BookingConflictException(String message) {
        super(HttpStatus.CONFLICT, "VEHICLE_NOT_AVAILABLE", message);
    }

    public static BookingConflictException forWindow(Long vehicleId, LocalDate pickup, LocalDate ret) {
        return new BookingConflictException(
                "Vehicle " + vehicleId + " is already reserved for part of "
                        + pickup + " to " + ret + ". Please pick different dates or another vehicle.");
    }
}

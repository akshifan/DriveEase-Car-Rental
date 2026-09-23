package com.driveease.exception;

import org.springframework.http.HttpStatus;

/** 409 - the vehicle is retired, in maintenance or otherwise not bookable. */
public class VehicleUnavailableException extends ApiException {

    public VehicleUnavailableException(String message) {
        super(HttpStatus.CONFLICT, "VEHICLE_UNAVAILABLE", message);
    }
}

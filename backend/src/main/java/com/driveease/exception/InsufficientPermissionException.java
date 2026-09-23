package com.driveease.exception;

import org.springframework.http.HttpStatus;

public class InsufficientPermissionException extends ApiException {

    public InsufficientPermissionException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}

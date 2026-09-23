package com.driveease.exception;

import org.springframework.http.HttpStatus;

public class DuplicateResourceException extends ApiException {

    public DuplicateResourceException(String code, String message) {
        super(HttpStatus.CONFLICT, code, message);
    }
}

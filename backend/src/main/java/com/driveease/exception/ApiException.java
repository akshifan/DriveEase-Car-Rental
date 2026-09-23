package com.driveease.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for every expected domain failure. Sub-classes declare the HTTP
 * status and a stable machine readable {@code code} used by the frontend.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    protected ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}

package com.driveease.exception;

import org.springframework.http.HttpStatus;

/** 400/422 - syntactically valid request that breaks a business rule. */
public class InvalidRequestException extends ApiException {

    public InvalidRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message);
    }

    public InvalidRequestException(String code, String message) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    public InvalidRequestException(HttpStatus status, String code, String message) {
        super(status, code, message);
    }

    public static InvalidRequestException unprocessable(String code, String message) {
        return new InvalidRequestException(code, message);
    }

    /** 400: syntactically fine but the supplied credential/token cannot be used. */
    public static InvalidRequestException badRequest(String code, String message) {
        return new InvalidRequestException(org.springframework.http.HttpStatus.BAD_REQUEST, code, message);
    }
}

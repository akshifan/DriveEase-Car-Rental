package com.driveease.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Structured error contract. Stack traces and internal exception messages are
 * never part of this payload (see GlobalExceptionHandler).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        LocalDateTime timestamp,
        int status,
        String code,
        String message,
        String path,
        List<FieldError> fieldErrors,
        Map<String, Object> details
) {
    public record FieldError(String field, String message, Object rejectedValue) {
    }

    public static ApiErrorResponse of(int status, String code, String message, String path) {
        return new ApiErrorResponse(LocalDateTime.now(), status, code, message, path, null, null);
    }

    public static ApiErrorResponse of(int status, String code, String message, String path,
                                      List<FieldError> fieldErrors) {
        return new ApiErrorResponse(LocalDateTime.now(), status, code, message, path, fieldErrors, null);
    }

    public static ApiErrorResponse of(int status, String code, String message, String path,
                                      List<FieldError> fieldErrors, Map<String, Object> details) {
        return new ApiErrorResponse(LocalDateTime.now(), status, code, message, path, fieldErrors, details);
    }
}

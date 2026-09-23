package com.driveease.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

/**
 * Explicit CORS allow-list. Wildcards are rejected at startup so a
 * misconfiguration can never expose the API with credentials enabled.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "driveease.cors")
public class CorsProperties {

    private String allowedOrigins = "http://localhost:5173";

    public List<String> originList() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }

    public void validate() {
        List<String> origins = originList();
        if (origins.isEmpty()) {
            throw new IllegalStateException("driveease.cors.allowed-origins must not be empty");
        }
        if (origins.contains("*")) {
            throw new IllegalStateException(
                    "driveease.cors.allowed-origins must list explicit origins, '*' is not permitted "
                            + "because the API accepts credentialed requests.");
        }
    }
}

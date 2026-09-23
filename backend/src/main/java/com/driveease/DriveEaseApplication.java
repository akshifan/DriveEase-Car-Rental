package com.driveease;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * DriveEase - car rental management API.
 *
 * <p>Flyway owns the schema, Hibernate only validates it. Configuration is
 * environment driven: no secret has a usable production default.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class DriveEaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(DriveEaseApplication.class, args);
    }
}

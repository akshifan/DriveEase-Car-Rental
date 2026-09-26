package com.driveease.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

/** Root {@code driveease.*} configuration tree. */
@Getter
@Setter
@ConfigurationProperties(prefix = "driveease")
public class AppProperties {

    private Payment payment = new Payment();
    private Booking booking = new Booking();
    private Email email = new Email();
    private Seed seed = new Seed();
    private Uploads uploads = new Uploads();

    @Getter
    @Setter
    public static class Payment {
        /** SANDBOX (deterministic simulation), ALWAYS_SUCCEED, ALWAYS_FAIL. */
        private String gatewayMode = "SANDBOX";
        private BigDecimal failureThresholdAmount = new BigDecimal("100000.00");
        private String referencePrefix = "DE-TXN";
    }

    @Getter
    @Setter
    public static class Booking {
        private int maxAdvanceDays = 180;
        private int minRentalDays = 1;
        private int maxRentalDays = 60;
    }

    @Getter
    @Setter
    public static class Email {
        /** mock = rendered to the log; smtp = delivered through JavaMail. */
        private String provider = "mock";
        private String from = "no-reply@driveease.app";
        private String fromName = "DriveEase";
        private String appBaseUrl = "http://localhost:5173";
    }

    @Getter
    @Setter
    public static class Seed {
        private boolean enabled = true;
    }

    @Getter
    @Setter
    public static class Uploads {
        private String directory = "./uploads";
    }

    private Fleet fleet = new Fleet();

    @Getter
    @Setter
    public static class Fleet {
        /** DEV ONLY: skip email verification for fleet registrations. */
        private boolean autoVerify = false;
    }
}

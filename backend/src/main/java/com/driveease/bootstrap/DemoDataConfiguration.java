package com.driveease.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Runs {@link DemoDataSeeder} on startup when {@code driveease.seed.enabled=true}.
 *
 * <p>The runner is a thin bean so the seeding itself stays inside a proxied
 * {@code @Transactional} service method (self-invocation would bypass the proxy).</p>
 */
@Configuration
@ConditionalOnProperty(prefix = "driveease.seed", name = "enabled", havingValue = "true")
public class DemoDataConfiguration {

    private static final Logger log = LoggerFactory.getLogger(DemoDataConfiguration.class);

    @Bean
    ApplicationRunner demoDataRunner(DemoDataSeeder seeder) {
        return args -> {
            try {
                seeder.seed();
            } catch (Exception ex) {
                // Demo data is a convenience: never block application startup on it.
                log.warn("Demo data seeding skipped: {}", ex.getMessage());
            }
        };
    }
}

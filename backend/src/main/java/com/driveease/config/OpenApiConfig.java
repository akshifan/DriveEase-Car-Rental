package com.driveease.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Value("${driveease.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public OpenAPI driveEaseOpenAPI() {
        final String schemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("DriveEase API")
                        .version("v1")
                        .description("""
                                Car rental management REST API: catalogue search, booking engine,
                                sandbox payments with refunds, fleet operations, reviews and reporting.

                                **Authentication** - obtain a JWT from `POST /api/v1/auth/login` and send it as
                                `Authorization: Bearer <token>`. The refresh token is delivered as an HttpOnly
                                cookie scoped to `/api/v1/auth`.

                                **Roles** - `CUSTOMER` books and reviews, `FLEET_MANAGER` runs daily fleet
                                operations, `ADMIN` manages users, refunds, moderation and reports.
                                """)
                        .contact(new Contact().name("DriveEase Engineering").email("engineering@driveease.app"))
                        .license(new License().name("MIT")))
                .servers(List.of(
                        new Server().url("/").description("Current host"),
                        new Server().url("http://localhost:8080").description("Local development")))
                .components(new Components().addSecuritySchemes(schemeName,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Paste the access token from /auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(schemeName));
    }
}

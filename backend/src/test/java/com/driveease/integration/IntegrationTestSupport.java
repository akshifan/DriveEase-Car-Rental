package com.driveease.integration;

import com.driveease.entity.*;
import com.driveease.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Shared plumbing for the integration tests.
 *
 * <p>These tests run against a real PostgreSQL database
 * ({@code driveease_test}), built by the same Flyway migrations that provision
 * production. That means the schema, the CHECK constraints, the partial indexes
 * and the query behaviour are all exercised for real.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestSupport {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JdbcTemplate jdbcTemplate;
    @Autowired protected UserRepository userRepository;
    @Autowired protected VehicleRepository vehicleRepository;
    @Autowired protected BookingRepository bookingRepository;
    @Autowired protected PaymentRepository paymentRepository;
    @Autowired protected RefundRepository refundRepository;
    @Autowired protected ReviewRepository reviewRepository;
    @Autowired protected PasswordEncoder passwordEncoder;

    protected static final String PASSWORD = "Passw0rd!";

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE refunds, payments, reviews, notifications, audit_logs,
                       maintenance_records, damage_records, vehicle_images, bookings,
                       refresh_tokens, password_reset_tokens, vehicles, users
                RESTART IDENTITY CASCADE
                """);
    }

    // ------------------------------------------------------------- fixtures

    protected User createUser(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFirstName("Test");
        user.setLastName(role.name().charAt(0) + "User");
        user.setPhone("+91 98200 00000");
        user.setLicenseNo("DL-TEST-" + Math.abs(email.hashCode() % 100000));
        user.setRole(role);
        user.setActive(true);
        return userRepository.save(user);
    }

    protected Vehicle createVehicle(String plate, BigDecimal dailyRate, VehicleStatus status) {
        Vehicle vehicle = new Vehicle();
        vehicle.setMake("Toyota");
        vehicle.setModel("Camry " + plate);
        vehicle.setYear(2023);
        vehicle.setCategory(VehicleCategory.LUXURY);
        vehicle.setLicensePlate(plate);
        vehicle.setDailyRate(dailyRate);
        vehicle.setDepositAmount(new BigDecimal("10000.00"));
        vehicle.setFuelType(FuelType.HYBRID);
        vehicle.setTransmission(Transmission.AUTOMATIC);
        vehicle.setSeats(5);
        vehicle.setDoors(4);
        vehicle.setLocation("Mangaluru");
        vehicle.setMileage(12000);
        vehicle.setStatus(status);
        return vehicleRepository.save(vehicle);
    }

    protected Booking createBooking(User user, Vehicle vehicle, LocalDate pickup, LocalDate ret,
                                    BookingStatus status) {
        int days = (int) java.time.temporal.ChronoUnit.DAYS.between(pickup, ret);
        BigDecimal base = vehicle.getDailyRate().multiply(BigDecimal.valueOf(days)).setScale(2);
        Booking booking = new Booking();
        booking.setBookingReference("IT-%s-%d".formatted(pickup, Math.abs((plate(vehicle) + pickup).hashCode() % 10000)));
        booking.setUser(user);
        booking.setVehicle(vehicle);
        booking.setPickupDate(pickup);
        booking.setReturnDate(ret);
        booking.setPickupLocation("Mangaluru");
        booking.setReturnLocation("Mangaluru");
        booking.setTotalDays(days);
        booking.setDailyRate(vehicle.getDailyRate());
        booking.setBaseAmount(base);
        booking.setDepositAmount(vehicle.getDepositAmount());
        booking.setTotalAmount(base.add(vehicle.getDepositAmount()));
        booking.setStatus(status);
        return bookingRepository.save(booking);
    }

    private String plate(Vehicle vehicle) {
        return vehicle.getLicensePlate();
    }

    // --------------------------------------------------------------- helpers

    /** Registers/logs a user in and returns the bearer token plus the refresh cookie. */
    protected Session login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String cookie = result.getResponse().getHeader("Set-Cookie");
        return new Session(body.path("accessToken").asText(), cookie);
    }

    protected Session register(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", PASSWORD,
                                "firstName", "Test",
                                "lastName", "Customer",
                                "phone", "+91 98200 12345",
                                "licenseNo", "DL-IT-" + Math.abs(email.hashCode() % 1000000)))))
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String cookie = result.getResponse().getHeader("Set-Cookie");
        return new Session(body.path("accessToken").asText(), cookie);
    }

    protected MockHttpServletRequestBuilder authorised(MockHttpServletRequestBuilder builder, Session session) {
        return builder.header("Authorization", "Bearer " + session.accessToken());
    }

    protected JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected record Session(String accessToken, String setCookie) {

        /** The {@code name=value} form of the refresh cookie, as sent on the wire. */
        public String refreshCookie() {
            if (setCookie == null) {
                return null;
            }
            return setCookie.split(";")[0];
        }

        /** Raw refresh token value (used when building a Cookie for MockMvc requests). */
        public String refreshTokenValue() {
            String cookie = refreshCookie();
            return cookie == null ? null : cookie.substring(cookie.indexOf('=') + 1);
        }

        /**
         * MockMvc does not parse a raw {@code Cookie} header into request cookies, so tests
         * attach a real Cookie object - the same thing a browser sends.
         */
        public jakarta.servlet.http.Cookie refreshCookieObject() {
            return new jakarta.servlet.http.Cookie("driveease_refresh", refreshTokenValue());
        }
    }
}

package com.driveease.integration;

import com.driveease.entity.Booking;
import com.driveease.entity.Role;
import com.driveease.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Registration, login, JWT authorisation, refresh rotation and role guards. */
class AuthAndAccessIT extends IntegrationTestSupport {

    @Test
    @DisplayName("registration stores a BCrypt hash, returns 201 and a JWT, and rejects duplicates")
    void registrationWorksAndRejectsDuplicates() throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "email", "new.customer@test.app",
                "password", PASSWORD,
                "firstName", "New",
                "lastName", "Customer",
                "phone", "+91 98200 11111",
                "licenseNo", "DL-NEW-0001"));

        MvcResult created = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly")))
                .andReturn();

        assertThat(json(created).get("user").get("passwordHash")).isNull();

        User stored = userRepository.findByEmailIgnoreCase("new.customer@test.app").orElseThrow();
        assertThat(stored.getPasswordHash()).startsWith("{bcrypt}$2a$");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    @DisplayName("registration validates the payload")
    void registrationValidatesInput() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "not-an-email",
                                "password", "short",
                                "firstName", "",
                                "lastName", "X"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    @DisplayName("bad credentials answer 401 without revealing whether the account exists")
    void badCredentialsAnswer401() throws Exception {
        createUser("known@test.app", Role.CUSTOMER);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "known@test.app", "password", "WrongPass1"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "ghost@test.app", "password", "WrongPass1"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a deactivated account cannot log in")
    void deactivatedAccountIsRejected() throws Exception {
        User user = createUser("disabled@test.app", Role.CUSTOMER);
        user.setActive(false);
        userRepository.save(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "disabled@test.app", "password", PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
    }

    @Test
    @DisplayName("protecting endpoints: 401 without a token, 403 with the wrong role, 200 with the right one")
    void roleGuardsAreEnforcedByTheBackend() throws Exception {
        User customer = createUser("customer.role@test.app", Role.CUSTOMER);
        User manager = createUser("manager.role@test.app", Role.FLEET_MANAGER);
        Session customerSession = login(customer.getEmail());
        Session managerSession = login(manager.getEmail());

        mockMvc.perform(get("/api/v1/bookings")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/fleet/dashboard")).andExpect(status().isUnauthorized());

        mockMvc.perform(authorised(get("/api/v1/fleet/dashboard"), customerSession))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(authorised(get("/api/v1/admin/dashboard"), customerSession))
                .andExpect(status().isForbidden());

        mockMvc.perform(authorised(get("/api/v1/fleet/dashboard"), managerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVehicles").exists());

        mockMvc.perform(authorised(get("/api/v1/bookings"), customerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("the refresh token rotates and is delivered as an HttpOnly cookie")
    void refreshRotatesTheToken() throws Exception {
        createUser("refresh@test.app", Role.CUSTOMER);
        Session session = login("refresh@test.app");
        String firstCookie = session.refreshCookie();
        String firstToken = session.refreshTokenValue();
        assertThat(firstCookie).startsWith("driveease_refresh=");
        assertThat(session.setCookie()).contains("HttpOnly");

        MvcResult rotated = mockMvc.perform(post("/api/v1/auth/refresh").cookie(session.refreshCookieObject()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();

        String secondCookie = rotated.getResponse().getHeader("Set-Cookie");
        assertThat(secondCookie).isNotNull();
        assertThat(secondCookie.split(";")[0]).isNotEqualTo(firstCookie);

        // The replacement token works; the consumed one is refused.
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("driveease_refresh", firstToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a customer cannot read another customer's booking (404 instead of 403)")
    void anotherCustomersBookingIsNotReachable() throws Exception {
        User alice = createUser("alice@test.app", Role.CUSTOMER);
        User bob = createUser("bob@test.app", Role.CUSTOMER);
        var vehicle = createVehicle("KA-19-PRIV", new java.math.BigDecimal("2000.00"),
                com.driveease.entity.VehicleStatus.AVAILABLE);
        var booking = createBooking(alice, vehicle, java.time.LocalDate.now().plusDays(3),
                java.time.LocalDate.now().plusDays(5), com.driveease.entity.BookingStatus.CONFIRMED);
        Session bobSession = login(bob.getEmail());

        mockMvc.perform(authorised(get("/api/v1/bookings/" + booking.getId()), bobSession))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    @DisplayName("password reset tokens are single use and invalidate existing sessions")
    void passwordResetFlow() throws Exception {
        createUser("reset@test.app", Role.CUSTOMER);

        MvcResult forgot = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "reset@test.app"))))
                .andExpect(status().isAccepted())
                .andReturn();

        JsonNode body = json(forgot);
        String token = body.get("resetToken").asText();   // echoed only by the mock provider
        assertThat(token).isNotBlank();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "newPassword", "N3wPassw0rd!"))))
                .andExpect(status().isOk());

        // The new password works, the consumed token does not.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "reset@test.app", "password", "N3wPassw0rd!"))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "newPassword", "An0therPass!"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RESET_TOKEN_EXPIRED"));
    }

    @Test
    @DisplayName("forgot-password never reveals whether an account exists")
    void forgotPasswordDoesNotLeakAccountExistence() throws Exception {
        MvcResult unknown = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "nobody@test.app"))))
                .andExpect(status().isAccepted())
                .andReturn();
        assertThat(json(unknown).get("message").asText()).contains("If an account exists");
    }

    @Test
    @DisplayName("admins can deactivate a user, which immediately blocks their session")
    void adminDeactivationRevokesAccess() throws Exception {
        User customer = createUser("victim@test.app", Role.CUSTOMER);
        User admin = createUser("admin2@test.app", Role.ADMIN);
        Session adminSession = login(admin.getEmail());

        mockMvc.perform(authorised(patch("/api/v1/users/" + customer.getId() + "/status"), adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("active", false, "reason", "Terms violation"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        assertThat(refreshTokensRevoked(customer.getId())).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE action = 'USER_DEACTIVATED'", Long.class)).isEqualTo(1L);
    }

    @Test
    @DisplayName("the account list works with no filters at all (nullable search must not break the query)")
    void adminUserListSupportsEmptyAndFilteredSearches() throws Exception {
        createUser("alpha@test.app", Role.CUSTOMER);
        createUser("beta@test.app", Role.FLEET_MANAGER);
        User admin = createUser("listadmin@test.app", Role.ADMIN);
        Session adminSession = login(admin.getEmail());

        // No filters: the regression that produced "function lower(bytea) does not exist" on PostgreSQL.
        mockMvc.perform(authorised(get("/api/v1/users"), adminSession)
                        .param("page", "0").param("size", "10").param("sort", "createdAt,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3))
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(authorised(get("/api/v1/users"), adminSession).param("search", "alpha"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].email").value("alpha@test.app"));

        mockMvc.perform(authorised(get("/api/v1/users"), adminSession).param("role", "FLEET_MANAGER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].role").value("FLEET_MANAGER"));

        mockMvc.perform(authorised(get("/api/v1/users"), adminSession).param("active", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3));

        mockMvc.perform(authorised(get("/api/v1/users"), adminSession)
                        .param("search", "alpha").param("role", "CUSTOMER").param("active", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        // Staff below admin level still cannot read the directory.
        Session managerSession = login("beta@test.app");
        mockMvc.perform(authorised(get("/api/v1/users"), managerSession))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("the customer dashboard is scoped to the caller and needs authentication")
    void customerDashboardIsScopedToTheCaller() throws Exception {
        User customer = createUser("dash@test.app", Role.CUSTOMER);
        User other = createUser("other@test.app", Role.CUSTOMER);
        var vehicle = createVehicle("KA-19-DASH-1", new BigDecimal("2500.00"), com.driveease.entity.VehicleStatus.AVAILABLE);

        LocalDate today = LocalDate.now();
        Booking booking = createBooking(customer, vehicle, today.plusDays(3), today.plusDays(6),
                com.driveease.entity.BookingStatus.CONFIRMED);
        createBooking(other, vehicle, today.plusDays(20), today.plusDays(22),
                com.driveease.entity.BookingStatus.PENDING);

        Session session = login(customer.getEmail());
        MvcResult result = mockMvc.perform(authorised(get("/api/v1/dashboard/customer"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalBookings").value(1))
                .andExpect(jsonPath("$.upcomingBookings.length()").value(1))
                .andExpect(jsonPath("$.upcomingBookings[0].bookingReference").value(booking.getBookingReference()))
                .andExpect(jsonPath("$.lifetimeSpend").exists())
                .andExpect(jsonPath("$.unreadNotifications").exists())
                .andReturn();

        // The other customer's booking is not part of this summary.
        assertThat(json(result).get("upcomingBookings").toString())
                .doesNotContain(other.getEmail());

        mockMvc.perform(get("/api/v1/dashboard/customer"))
                .andExpect(status().isUnauthorized());
    }

    private boolean refreshTokensRevoked(Long userId) {
        Long active = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = false", Long.class, userId);
        return active != null && active == 0;
    }
}

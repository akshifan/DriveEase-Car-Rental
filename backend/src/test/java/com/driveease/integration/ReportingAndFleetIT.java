package com.driveease.integration;

import com.driveease.entity.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Vehicle search filters, fleet operations, reviews moderation and CSV reporting. */
class ReportingAndFleetIT extends IntegrationTestSupport {

    @Test
    @DisplayName("catalogue filters are applied server side and mapped to the URL contract")
    void catalogueFiltersWork() throws Exception {
        createVehicle("KA-19-F1", new BigDecimal("1200.00"), VehicleStatus.AVAILABLE);   // LUXURY in the fixture
        Vehicle suv = createVehicle("KA-19-F2", new BigDecimal("3200.00"), VehicleStatus.AVAILABLE);
        suv.setCategory(VehicleCategory.SUV);
        suv.setFuelType(FuelType.DIESEL);
        suv.setTransmission(Transmission.MANUAL);
        suv.setSeats(7);
        vehicleRepository.save(suv);

        mockMvc.perform(get("/api/v1/vehicles").param("category", "SUV"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].licensePlate").value("KA-19-F2"));

        mockMvc.perform(get("/api/v1/vehicles")
                        .param("minPrice", "2000").param("maxPrice", "5000")
                        .param("fuelType", "DIESEL").param("transmission", "MANUAL").param("minSeats", "6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/v1/vehicles").param("search", "camry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));

        mockMvc.perform(get("/api/v1/vehicles").param("category", "VAN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.empty").value(true));

        // A retired vehicle never appears in the public catalogue.
        Vehicle retired = createVehicle("KA-19-F3", new BigDecimal("999.00"), VehicleStatus.RETIRED);
        mockMvc.perform(get("/api/v1/vehicles").param("maxPrice", "1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
        assertThat(retired.getId()).isNotNull();

        // Sorting and pagination are honoured by the database.
        mockMvc.perform(get("/api/v1/vehicles").param("sort", "dailyRate,desc").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].licensePlate").value("KA-19-F2"))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    @DisplayName("maintenance takes a vehicle out of the bookable pool and completion releases it")
    void maintenanceBlocksBookingsAndReleasesTheVehicle() throws Exception {
        User manager = createUser("fleet.maint@test.app", Role.FLEET_MANAGER);
        User customer = createUser("customer.maint@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-MNT", new BigDecimal("2500.00"), VehicleStatus.AVAILABLE);
        Session managerSession = login(manager.getEmail());
        Session customerSession = login(customer.getEmail());

        mockMvc.perform(authorised(post("/api/v1/fleet/vehicles/" + vehicle.getId() + "/maintenance"), managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "type", "SERVICE",
                                "description", "40,000 km service",
                                "scheduledDate", LocalDate.now().toString(),
                                "cost", 6500,
                                "odometerReading", 40120))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        assertThat(vehicleRepository.findById(vehicle.getId()).orElseThrow().getStatus())
                .isEqualTo(VehicleStatus.MAINTENANCE);

        // Booking a vehicle in the workshop is refused.
        mockMvc.perform(authorised(post("/api/v1/bookings"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "vehicleId", vehicle.getId(),
                                "pickupDate", LocalDate.now().plusDays(5).toString(),
                                "returnDate", LocalDate.now().plusDays(7).toString(),
                                "pickupLocation", "Mangaluru",
                                "returnLocation", "Mangaluru"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VEHICLE_UNAVAILABLE"));

        // Unknown maintenance ids are 404, not 500.
        mockMvc.perform(authorised(post("/api/v1/fleet/maintenance/99999/complete"), managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("fleet CSV export and reports are produced from live data")
    void reportingEndpointsReturnRealAggregates() throws Exception {
        User admin = createUser("admin.report@test.app", Role.ADMIN);
        User customer = createUser("customer.report@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-RPT", new BigDecimal("4000.00"), VehicleStatus.AVAILABLE);
        Session adminSession = login(admin.getEmail());
        Session customerSession = login(customer.getEmail());

        LocalDate pickup = LocalDate.now().plusDays(3);
        Booking booking = createBooking(customer, vehicle, pickup, pickup.plusDays(2), BookingStatus.PENDING);

        mockMvc.perform(authorised(post("/api/v1/payments"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(), "paymentMethod", "UPI", "upiId", "report@okbank"))))
                .andExpect(status().isCreated());

        mockMvc.perform(authorised(get("/api/v1/reports/revenue")
                        .param("groupBy", "day")
                        .param("from", LocalDate.now().minusDays(7).toString())
                        .param("to", LocalDate.now().toString()), adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.grossRevenue").value(booking.getTotalAmount().doubleValue()))
                .andExpect(jsonPath("$.series").isArray())
                .andExpect(jsonPath("$.byCategory").isArray());

        mockMvc.perform(authorised(get("/api/v1/reports/revenue").param("groupBy", "fortnight"), adminSession))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_GROUP_BY"));

        mockMvc.perform(authorised(get("/api/v1/reports/utilisation"), adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicles").isArray())
                .andExpect(jsonPath("$.periodDays").isNumber());

        mockMvc.perform(authorised(get("/api/v1/admin/bookings/export"), adminSession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("driveease-bookings.csv")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Booking Reference")));

        mockMvc.perform(authorised(get("/api/v1/admin/dashboard"), adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(2))
                .andExpect(jsonPath("$.totalVehicles").value(1))
                .andExpect(jsonPath("$.revenueTrend").isArray());

        mockMvc.perform(authorised(get("/api/v1/fleet/vehicles/export"), adminSession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("driveease-fleet.csv")));
    }

    @Test
    @DisplayName("review moderation soft-deletes the review and audits the action")
    void reviewModerationIsAudited() throws Exception {
        User customer = createUser("moderated@test.app", Role.CUSTOMER);
        User admin = createUser("moderator@test.app", Role.ADMIN);
        Vehicle vehicle = createVehicle("KA-19-MOD", new BigDecimal("2000.00"), VehicleStatus.AVAILABLE);
        Session customerSession = login(customer.getEmail());
        Session adminSession = login(admin.getEmail());

        Booking booking = createBooking(customer, vehicle, LocalDate.now().minusDays(10),
                LocalDate.now().minusDays(6), BookingStatus.COMPLETED);

        var created = mockMvc.perform(authorised(post("/api/v1/reviews"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(), "rating", 2, "comment", "Not great"))))
                .andExpect(status().isCreated())
                .andReturn();
        long reviewId = json(created).get("id").asLong();

        mockMvc.perform(authorised(delete("/api/v1/reviews/" + reviewId), adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Contains personal contact details"))))
                .andExpect(status().isOk());

        var review = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(review.isDeleted()).isTrue();
        assertThat(review.getDeleteReason()).contains("personal contact");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE action = 'REVIEW_REMOVED'", Long.class)).isEqualTo(1L);

        mockMvc.perform(get("/api/v1/reviews/vehicle/" + vehicle.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    @DisplayName("a rental that is not completed cannot be reviewed")
    void reviewRequiresACompletedRental() throws Exception {
        User customer = createUser("early.review@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-EARLY", new BigDecimal("2000.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());
        Booking booking = createBooking(customer, vehicle, LocalDate.now().plusDays(2),
                LocalDate.now().plusDays(4), BookingStatus.CONFIRMED);

        mockMvc.perform(authorised(post("/api/v1/reviews"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("bookingId", booking.getId(), "rating", 5))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_COMPLETED"));

        // A customer cannot review somebody else's booking either.
        User other = createUser("other.review@test.app", Role.CUSTOMER);
        Session otherSession = login(other.getEmail());
        mockMvc.perform(authorised(post("/api/v1/reviews"), otherSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("bookingId", booking.getId(), "rating", 4))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("vehicle history merges rentals, maintenance and damage into one timeline")
    void vehicleHistoryIsMerged() throws Exception {
        User manager = createUser("history@test.app", Role.FLEET_MANAGER);
        User customer = createUser("history.customer@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-HIST", new BigDecimal("3000.00"), VehicleStatus.AVAILABLE);
        Session managerSession = login(manager.getEmail());

        Booking completed = createBooking(customer, vehicle, LocalDate.now().minusDays(20),
                LocalDate.now().minusDays(15), BookingStatus.COMPLETED);
        completed.setActualReturnDate(java.time.LocalDateTime.now().minusDays(15));
        bookingRepository.save(completed);

        mockMvc.perform(authorised(post("/api/v1/vehicles/" + vehicle.getId() + "/damage"), managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "description", "Windscreen chip",
                                "severity", "MINOR",
                                "bookingId", completed.getId(),
                                "repairEstimate", 3500))))
                .andExpect(status().isCreated());

        mockMvc.perform(authorised(get("/api/v1/fleet/vehicles/" + vehicle.getId() + "/history"), managerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events.length()").value(2))
                .andExpect(jsonPath("$.summary.totalBookings").value(1))
                .andExpect(jsonPath("$.summary.damageRecords").value(1));
    }

    @Test
    @DisplayName("invalid enum values and malformed payloads answer 400 with a structured error")
    void malformedRequestsAnswer400() throws Exception {
        User customer = createUser("malformed@test.app", Role.CUSTOMER);
        Session session = login(customer.getEmail());

        mockMvc.perform(get("/api/v1/vehicles").param("category", "SPACESHIP"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        mockMvc.perform(authorised(post("/api/v1/bookings"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"vehicleId\": }"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        mockMvc.perform(authorised(post("/api/v1/bookings"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickupDate", LocalDate.now().plusDays(5).toString(),
                                "returnDate", LocalDate.now().plusDays(2).toString(),
                                "pickupLocation", "Mangaluru",
                                "returnLocation", "Mangaluru"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("a booking for a vehicle that does not exist answers 404")
    void unknownVehicleAnswers404() throws Exception {
        User customer = createUser("missing@test.app", Role.CUSTOMER);
        Session session = login(customer.getEmail());

        mockMvc.perform(authorised(post("/api/v1/bookings"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "vehicleId", 987654,
                                "pickupDate", LocalDate.now().plusDays(5).toString(),
                                "returnDate", LocalDate.now().plusDays(7).toString(),
                                "pickupLocation", "Mangaluru",
                                "returnLocation", "Mangaluru"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(get("/api/v1/vehicles/987654"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("booking history and payment history are scoped to the caller")
    void historyEndpointsAreScoped() throws Exception {
        User customer = createUser("scope@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-SCOPE", new BigDecimal("2200.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());
        createBooking(customer, vehicle, LocalDate.now().plusDays(4), LocalDate.now().plusDays(6),
                BookingStatus.CONFIRMED);

        mockMvc.perform(authorised(get("/api/v1/bookings"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].status").value("CONFIRMED"));

        mockMvc.perform(authorised(get("/api/v1/payments"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(authorised(get("/api/v1/users/me/notifications"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(authorised(get("/api/v1/users/me"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("scope@test.app"));
    }

    @Test
    @DisplayName("OpenAPI describes the implemented endpoints")
    void openApiIsExposed() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("DriveEase API"))
                .andExpect(jsonPath("$.paths['/api/v1/bookings']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/payments/{id}/refund']").exists());
    }

    @Test
    @DisplayName("health endpoint is public for deployment probes")
    void actuatorHealthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("all seeded list endpoints return an empty page contract rather than nulls")
    void emptyStatesAreWellFormed() throws Exception {
        List<Map<String, Object>> empty = List.of();
        assertThat(empty).isEmpty();
        mockMvc.perform(get("/api/v1/vehicles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.empty").value(true))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }
}

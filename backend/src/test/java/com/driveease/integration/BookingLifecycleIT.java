package com.driveease.integration;

import com.driveease.entity.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The critical end-to-end scenario from the PRD test plan:
 * register -> login -> search -> create booking -> pay -> pickup -> return -> review.
 * Includes the date-overlap conflict case that must answer 409 and persist nothing.
 */
class BookingLifecycleIT extends IntegrationTestSupport {

    @Test
    @DisplayName("an overlapping booking is rejected with 409 and no extra booking is stored")
    void dateConflictIsRejectedWithoutPersistence() throws Exception {
        User customer = createUser("customer@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-CONFLICT", new BigDecimal("4000.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());

        LocalDate pickup = LocalDate.now().plusDays(20);
        LocalDate ret = pickup.plusDays(4);

        // Existing confirmed reservation for exactly this window.
        createBooking(customer, vehicle, pickup, ret, BookingStatus.CONFIRMED);
        long before = bookingRepository.count();

        MvcResult result = mockMvc.perform(authorised(post("/api/v1/bookings"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "vehicleId", vehicle.getId(),
                                "pickupDate", pickup.toString(),
                                "returnDate", ret.toString(),
                                "pickupLocation", "Mangaluru",
                                "returnLocation", "Mangaluru"))))
                .andExpect(status().isConflict())
                .andReturn();

        JsonNode error = json(result);
        assertThat(error.get("code").asText()).isEqualTo("VEHICLE_NOT_AVAILABLE");
        assertThat(error.get("status").asInt()).isEqualTo(409);
        assertThat(bookingRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("a conflicting window is also excluded from the public availability search")
    void availabilitySearchExcludesBookedWindows() throws Exception {
        User customer = createUser("searcher@test.app", Role.CUSTOMER);
        Vehicle booked = createVehicle("KA-19-BOOKED", new BigDecimal("4000.00"), VehicleStatus.AVAILABLE);
        Vehicle free = createVehicle("KA-19-FREE", new BigDecimal("3500.00"), VehicleStatus.AVAILABLE);

        LocalDate pickup = LocalDate.now().plusDays(15);
        LocalDate ret = pickup.plusDays(3);
        createBooking(customer, booked, pickup, ret, BookingStatus.CONFIRMED);

        mockMvc.perform(get("/api/v1/vehicles")
                        .param("pickupDate", pickup.toString())
                        .param("returnDate", ret.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].licensePlate").value(free.getLicensePlate()));

        // A window that only brushes the tail of the booking is still free (half-open interval).
        MvcResult adjacent = mockMvc.perform(get("/api/v1/vehicles")
                        .param("pickupDate", ret.toString())
                        .param("returnDate", ret.plusDays(2).toString()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(json(adjacent).get("content").size()).isEqualTo(2);
    }

    @Test
    @DisplayName("full happy path: book -> pay (CONFIRMED) -> pickup (ACTIVE/RENTED) -> return (COMPLETED/AVAILABLE) -> review")
    void happyPathFromBookingToReview() throws Exception {
        User customer = createUser("lifecycle@test.app", Role.CUSTOMER);
        User manager = createUser("fleet@test.app", Role.FLEET_MANAGER);
        Vehicle vehicle = createVehicle("KA-19-LIFE", new BigDecimal("4000.00"), VehicleStatus.AVAILABLE);
        Session customerSession = login(customer.getEmail());
        Session managerSession = login(manager.getEmail());

        LocalDate pickup = LocalDate.now().plusDays(10);
        LocalDate ret = pickup.plusDays(4);   // 4 days -> 16,000 base + 10,000 deposit

        MvcResult created = mockMvc.perform(authorised(post("/api/v1/bookings"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "vehicleId", vehicle.getId(),
                                "pickupDate", pickup.toString(),
                                "returnDate", ret.toString(),
                                "pickupLocation", "Mangaluru",
                                "returnLocation", "Mangaluru"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.totalDays").value(4))
                .andExpect(jsonPath("$.totalAmount").value(26000.00))
                .andReturn();

        JsonNode booking = json(created);
        long bookingId = booking.get("id").asLong();
        String reference = booking.get("bookingReference").asText();
        assertThat(vehicleRepository.findById(vehicle.getId()).orElseThrow().getStatus())
                .isEqualTo(VehicleStatus.AVAILABLE);   // still available until pickup

        // 1. Payment succeeds and confirms the booking.
        mockMvc.perform(authorised(post("/api/v1/payments"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", bookingId,
                                "amount", 26000.00,
                                "paymentMethod", "CREDIT_CARD",
                                "cardLast4", "4242"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        assertThat(bookingRepository.findById(bookingId).orElseThrow().getStatus()).isEqualTo(BookingStatus.CONFIRMED);

        // 2. Pickup by the fleet manager.
        mockMvc.perform(authorised(patch("/api/v1/bookings/" + bookingId + "/status"), managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "status", "ACTIVE", "mileage", 14500, "note", "Handover at the airport desk"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        assertThat(bookingRepository.findById(bookingId).orElseThrow().getStatus()).isEqualTo(BookingStatus.ACTIVE);
        assertThat(vehicleRepository.findById(vehicle.getId()).orElseThrow().getStatus()).isEqualTo(VehicleStatus.RENTED);

        // 3. Return.
        mockMvc.perform(authorised(patch("/api/v1/bookings/" + bookingId + "/status"), managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "COMPLETED", "mileage", 15240))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        assertThat(vehicleRepository.findById(vehicle.getId()).orElseThrow().getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
        assertThat(vehicleRepository.findById(vehicle.getId()).orElseThrow().getMileage()).isEqualTo(15240);

        // 4. The completed rental can be reviewed exactly once.
        mockMvc.perform(authorised(post("/api/v1/reviews"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", bookingId,
                                "rating", 5,
                                "title", "Great highway car",
                                "comment", "Clean, quiet and the handover took ten minutes."))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rating").value(5));

        mockMvc.perform(authorised(post("/api/v1/reviews"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("bookingId", bookingId, "rating", 3))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVIEW_ALREADY_SUBMITTED"));

        mockMvc.perform(get("/api/v1/reviews/summary/" + vehicle.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount").value(1))
                .andExpect(jsonPath("$.averageRating").value(5.0));

        assertThat(reference).startsWith("DE-");
    }

    @Test
    @DisplayName("a declined payment leaves the booking PENDING and records the failure")
    void declinedPaymentKeepsBookingPending() throws Exception {
        User customer = createUser("declined@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-DECL", new BigDecimal("3000.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());

        Booking booking = createBooking(customer, vehicle, LocalDate.now().plusDays(5), LocalDate.now().plusDays(8),
                BookingStatus.PENDING);

        mockMvc.perform(authorised(post("/api/v1/payments"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(),
                                "paymentMethod", "CREDIT_CARD",
                                "cardLast4", "0000"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("FAILED"));

        assertThat(bookingRepository.findById(booking.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.PENDING);
    }

    @Test
    @DisplayName("cancelling a paid booking refunds it and frees the window")
    void cancellationIssuesARefund() throws Exception {
        User customer = createUser("refund@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-REF", new BigDecimal("2500.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());

        LocalDate pickup = LocalDate.now().plusDays(12);
        Booking booking = createBooking(customer, vehicle, pickup, pickup.plusDays(3), BookingStatus.PENDING);
        BigDecimal total = booking.getTotalAmount();

        mockMvc.perform(authorised(post("/api/v1/payments"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(),
                                "paymentMethod", "UPI",
                                "upiId", "dev@okbank"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        mockMvc.perform(authorised(post("/api/v1/bookings/" + booking.getId() + "/cancel"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Plans changed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        var refunds = refundRepository.findAll();
        assertThat(refunds).hasSize(1);
        assertThat(refunds.get(0).getSource()).isEqualTo(RefundSource.CANCELLATION);
        assertThat(refunds.get(0).getAmount()).isEqualByComparingTo(total);
    }

    @Test
    @DisplayName("a second payment for the same booking is rejected with 409")
    void cannotPayTwice() throws Exception {
        User customer = createUser("twice@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-TWICE", new BigDecimal("2000.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());
        Booking booking = createBooking(customer, vehicle, LocalDate.now().plusDays(7),
                LocalDate.now().plusDays(9), BookingStatus.CONFIRMED);

        mockMvc.perform(authorised(post("/api/v1/payments"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(), "paymentMethod", "CASH"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_ALREADY_SETTLED"));
    }

    @Test
    @DisplayName("a payment for a cancelled booking is rejected")
    void cannotPayCancelledBooking() throws Exception {
        User customer = createUser("cancelled@test.app", Role.CUSTOMER);
        Vehicle vehicle = createVehicle("KA-19-CANC", new BigDecimal("2000.00"), VehicleStatus.AVAILABLE);
        Session session = login(customer.getEmail());
        Booking booking = createBooking(customer, vehicle, LocalDate.now().plusDays(7),
                LocalDate.now().plusDays(9), BookingStatus.CANCELLED);

        mockMvc.perform(authorised(post("/api/v1/payments"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(), "paymentMethod", "CASH"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_CANCELLED"));
    }

    @Test
    @DisplayName("an admin can refund a payment in full or partially, but never beyond what was collected")
    void adminRefundsAreCapped() throws Exception {
        User customer = createUser("refundable@test.app", Role.CUSTOMER);
        User admin = createUser("admin@test.app", Role.ADMIN);
        Vehicle vehicle = createVehicle("KA-19-ADM", new BigDecimal("2000.00"), VehicleStatus.AVAILABLE);
        Session customerSession = login(customer.getEmail());
        Session adminSession = login(admin.getEmail());

        Booking booking = createBooking(customer, vehicle, LocalDate.now().plusDays(9),
                LocalDate.now().plusDays(11), BookingStatus.PENDING);
        booking.setTotalAmount(new BigDecimal("14000.00"));

        MvcResult paid = mockMvc.perform(authorised(post("/api/v1/payments"), customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "bookingId", booking.getId(), "paymentMethod", "CASH"))))
                .andExpect(status().isCreated())
                .andReturn();
        long paymentId = json(paid).get("id").asLong();

        // Over-refund is rejected.
        Map<String, Object> overRefund = new HashMap<>();
        overRefund.put("amount", 999999);
        overRefund.put("reason", "Too much");
        mockMvc.perform(authorised(post("/api/v1/payments/" + paymentId + "/refund"), adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overRefund)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("REFUND_EXCEEDS_PAYMENT"));

        // Partial refund succeeds and leaves the payment SUCCESS.
        mockMvc.perform(authorised(post("/api/v1/payments/" + paymentId + "/refund"), adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("amount", 4000, "reason", "Goodwill gesture"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(4000.00));

        assertThat(refundRepository.sumRefundedForPayment(paymentId)).isEqualByComparingTo("4000.00");
        assertThat(paymentRepository.findById(paymentId).orElseThrow().getStatus()).isEqualTo(PaymentStatus.SUCCESS);

        // The remaining balance refunds fully and flips the payment to REFUNDED.
        mockMvc.perform(authorised(post("/api/v1/payments/" + paymentId + "/refund"), adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Customer dispute resolved"))))
                .andExpect(status().isOk());

        assertThat(paymentRepository.findById(paymentId).orElseThrow().getStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }
}

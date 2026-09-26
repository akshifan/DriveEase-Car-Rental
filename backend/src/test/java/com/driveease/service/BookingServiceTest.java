package com.driveease.service;

import com.driveease.dto.booking.BookingCreateRequest;
import com.driveease.dto.booking.BookingStatusUpdateRequest;
import com.driveease.entity.*;
import com.driveease.exception.BookingConflictException;
import com.driveease.exception.InvalidBookingStateException;
import com.driveease.exception.VehicleUnavailableException;
import com.driveease.mapper.*;
import com.driveease.repository.*;
import com.driveease.repository.DamageRecordRepository;
import com.driveease.security.UserPrincipal;
import com.driveease.util.ReferenceGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Date-overlap protection and lifecycle rules of the booking engine. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingServiceTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private VehicleRepository vehicleRepository;
    @Mock private UserRepository userRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private ReviewRepository reviewRepository;
    @Mock private DamageRecordRepository damageRepository;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private ReferenceGenerator referenceGenerator;
    @Mock private BookingMapper bookingMapper;
    @Mock private PaymentMapper paymentMapper;
    @Mock private ReviewMapper reviewMapper;
    @Mock private VehicleMapper vehicleMapper;
    @Mock private RefundService refundService;
    @Mock private FleetAccessGuard fleetAccessGuard;   // ← NEW

    private BookingService bookingService;
    private PricingService pricingService;
    private User customer;
    private User fleetManager;
    private Vehicle vehicle;

    /** The fleet manager principal id used across the tests. */
    private static final Long FLEET_MANAGER_ID = 7L;
    private static final Long CUSTOMER_ID = 42L;

    @BeforeEach
    void setUp() {
        var properties = new com.driveease.config.AppProperties();
        pricingService = new PricingService(properties);

        fleetManager = new User();
        fleetManager.setId(FLEET_MANAGER_ID);
        fleetManager.setEmail("fleet@driveease.app");
        fleetManager.setFirstName("Riya");
        fleetManager.setLastName("Kulkarni");
        fleetManager.setRole(Role.FLEET_MANAGER);
        fleetManager.setActive(true);

        customer = new User();
        customer.setId(CUSTOMER_ID);
        customer.setEmail("dev@driveease.app");
        customer.setFirstName("Dev");
        customer.setLastName("Sharma");
        customer.setRole(Role.CUSTOMER);
        customer.setActive(true);

        vehicle = new Vehicle();
        vehicle.setId(11L);
        vehicle.setMake("Toyota");
        vehicle.setModel("Camry");
        vehicle.setDailyRate(new BigDecimal("4000.00"));
        vehicle.setDepositAmount(new BigDecimal("10000.00"));
        vehicle.setStatus(VehicleStatus.AVAILABLE);
        vehicle.setLicensePlate("KA-19-TEST-1");
        vehicle.setOwner(fleetManager);

        // Constructor order must match BookingService's actual signature,
        // including the FleetAccessGuard argument added last.
        bookingService = new BookingService(
            bookingRepository,
            vehicleRepository,
            userRepository,
            paymentRepository,
            reviewRepository,
            damageRepository,
            pricingService,
            notificationService,
            auditService,
            referenceGenerator,
            bookingMapper,
            paymentMapper,
            reviewMapper,
            vehicleMapper,
            refundService,
            fleetAccessGuard
        );

        // ------------------------------------------------------------------
        // Default stubs. Individual tests override as needed.
        // ------------------------------------------------------------------
        when(userRepository.findById(FLEET_MANAGER_ID)).thenReturn(Optional.of(fleetManager));
        when(userRepository.findById(CUSTOMER_ID)).thenReturn(Optional.of(customer));

        when(referenceGenerator.bookingReference(any())).thenReturn("DE-20261010-0001");

        // BOTH save and saveAndFlush must be stubbed: BookingService.create()
        // uses saveAndFlush(...), and every other path uses save(...).
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            if (booking.getId() == null) booking.setId(99L);
            return booking;
        });
        when(bookingRepository.saveAndFlush(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            if (booking.getId() == null) booking.setId(99L);
            return booking;
        });

        when(paymentRepository.findByBookingId(anyLong())).thenReturn(List.of());
        when(reviewRepository.findByBookingId(anyLong())).thenReturn(Optional.empty());
        when(refundService.refundedTotalForBooking(anyLong())).thenReturn(BigDecimal.ZERO);
        // By default no damage is logged against any booking, so the deposit
        // refund path fires. Individual tests can override this with a return value.
        when(damageRepository.findByBookingIdAndSeverityIn(anyLong(), anyList()))
            .thenReturn(List.of());
    }

    // =========================================================================
    // create()
    // =========================================================================

    @Test
    @DisplayName("an overlapping reservation is rejected with 409 and never persisted")
    void rejectsOverlappingBooking() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        LocalDate drop = pickup.plusDays(4);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.countOverlapping(eq(11L), eq(pickup), eq(drop), isNull())).thenReturn(1L);

        assertThatThrownBy(() -> bookingService.create(CUSTOMER_ID,
            new BookingCreateRequest(11L, pickup, drop, "Mangaluru", "Mangaluru", null)))
            .isInstanceOf(BookingConflictException.class)
            .hasMessageContaining("already reserved");

        verify(bookingRepository, never()).save(any(Booking.class));
        verify(bookingRepository, never()).saveAndFlush(any(Booking.class));
    }

    @Test
    @DisplayName("a free window creates a PENDING booking priced by the pricing service")
    void createsBookingWhenWindowIsFree() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        LocalDate drop = pickup.plusDays(4);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.countOverlapping(eq(11L), eq(pickup), eq(drop), isNull())).thenReturn(0L);

        bookingService.create(CUSTOMER_ID,
            new BookingCreateRequest(11L, pickup, drop, "Mangaluru", "Mangaluru", "Airport run"));

        // create() uses saveAndFlush, so that is the method we capture.
        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).saveAndFlush(captor.capture());
        Booking saved = captor.getValue();

        assertThat(saved).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(BookingStatus.PENDING);
        assertThat(saved.getTotalDays()).isEqualTo(4);
        assertThat(saved.getBaseAmount()).isEqualByComparingTo("16000.00");
        assertThat(saved.getDepositAmount()).isEqualByComparingTo("10000.00");
        assertThat(saved.getTotalAmount()).isEqualByComparingTo("26000.00");
        assertThat(saved.getVehicle()).isSameAs(vehicle);
        // The booking captures the vehicle's owning fleet, never the caller.
        assertThat(saved.getOwnerFleet()).isSameAs(fleetManager);

        // The vehicle is deliberately left AVAILABLE until the physical pickup (PRD EPIC-03).
        verify(vehicleRepository, never()).save(any(Vehicle.class));
    }

    @Test
    @DisplayName("a retired or servicing vehicle cannot be booked")
    void rejectsUnavailableVehicles() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        vehicle.setStatus(VehicleStatus.MAINTENANCE);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));

        assertThatThrownBy(() -> bookingService.create(CUSTOMER_ID,
            new BookingCreateRequest(11L, pickup, pickup.plusDays(2), "Mangaluru", "Mangaluru", null)))
            .isInstanceOf(VehicleUnavailableException.class)
            .hasMessageContaining("maintenance");

        verify(bookingRepository, never()).save(any(Booking.class));
        verify(bookingRepository, never()).saveAndFlush(any(Booking.class));
    }

    // =========================================================================
    // updateStatus() — fleet manager workflow
    // =========================================================================

    @Test
    @DisplayName("pickup moves CONFIRMED to ACTIVE and the vehicle to RENTED")
    void pickupStartsTheRental() {
        Booking booking = booking(BookingStatus.CONFIRMED, fleetManager);
        // FLEET_MANAGER role dispatches to findByIdAndOwnerFleet, not findDetailById.
        when(bookingRepository.findByIdAndOwnerFleet(99L, FLEET_MANAGER_ID)).thenReturn(Optional.of(booking));
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateStatus(99L,
            new BookingStatusUpdateRequest(BookingStatus.ACTIVE, 30_120, "Handed over at the airport desk"),
            principal(Role.FLEET_MANAGER, FLEET_MANAGER_ID));

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.RENTED);
        assertThat(booking.getActualPickupDate()).isNotNull();
        assertThat(booking.getMileageOut()).isEqualTo(30_120);
        verify(notificationService).onBookingActive(booking);
    }

    @Test
    @DisplayName("return moves ACTIVE to COMPLETED and frees the vehicle")
    void returnCompletesTheRental() {
        Booking booking = booking(BookingStatus.ACTIVE, fleetManager);
        vehicle.setStatus(VehicleStatus.RENTED);
        when(bookingRepository.findByIdAndOwnerFleet(99L, FLEET_MANAGER_ID)).thenReturn(Optional.of(booking));
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateStatus(99L,
            new BookingStatusUpdateRequest(BookingStatus.COMPLETED, 30_890, null),
            principal(Role.FLEET_MANAGER, FLEET_MANAGER_ID));

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
        assertThat(booking.getActualReturnDate()).isNotNull();
        assertThat(vehicle.getMileage()).isEqualTo(30_890);
        verify(notificationService).onBookingCompleted(booking);
    }

    @Test
    @DisplayName("skipping states is rejected with 409 INVALID_BOOKING_STATE")
    void rejectsIllegalTransitions() {
        Booking booking = booking(BookingStatus.PENDING, fleetManager);
        when(bookingRepository.findByIdAndOwnerFleet(99L, FLEET_MANAGER_ID)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> bookingService.updateStatus(99L,
            new BookingStatusUpdateRequest(BookingStatus.ACTIVE, null, null),
            principal(Role.FLEET_MANAGER, FLEET_MANAGER_ID)))
            .isInstanceOf(InvalidBookingStateException.class)
            .hasMessageContaining("PENDING to ACTIVE");
    }

    // =========================================================================
    // cancel()
    // =========================================================================

    @Test
    @DisplayName("a completed rental cannot be cancelled")
    void rejectsCancellingCompletedRental() {
        Booking booking = booking(BookingStatus.COMPLETED, customer);
        // CUSTOMER role dispatches to findDetailById + assertCanView.
        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> bookingService.cancel(99L,
            principal(Role.CUSTOMER, CUSTOMER_ID), "changed my mind"))
            .isInstanceOf(InvalidBookingStateException.class);
    }

    @Test
    @DisplayName("cancelling a paid booking triggers a refund")
    void cancellationRefundsPaidBookings() {
        Booking booking = booking(BookingStatus.CONFIRMED, customer);
        Payment payment = new Payment();
        payment.setId(5L);
        payment.setBooking(booking);
        payment.setAmount(new BigDecimal("26000.00"));
        payment.setStatus(PaymentStatus.SUCCESS);

        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentRepository.findByBookingIdAndStatus(99L, PaymentStatus.SUCCESS)).thenReturn(List.of(payment));

        bookingService.cancel(99L, principal(Role.CUSTOMER, CUSTOMER_ID), "Plans changed");

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        verify(refundService).refundOnCancellation(payment, "Cancellation: Plans changed");
        verify(notificationService).onBookingCancelled(booking, "Plans changed");
    }

    // =========================================================================
    // fixtures
    // =========================================================================

    /**
     * Builds a booking fixture. The {@code owner} becomes the booking's ownerFleet,
     * matching the real invariant "a booking's fleet owner is the vehicle's owner".
     */
    private Booking booking(BookingStatus status, User owner) {
        Booking booking = new Booking();
        booking.setId(99L);
        booking.setBookingReference("DE-20261010-0001");
        booking.setUser(customer);
        booking.setVehicle(vehicle);
        booking.setOwnerFleet(owner);
        booking.setPickupDate(LocalDate.now().plusDays(3));
        booking.setReturnDate(LocalDate.now().plusDays(6));
        booking.setPickupLocation("Mangaluru");
        booking.setReturnLocation("Mangaluru");
        booking.setTotalDays(3);
        booking.setDailyRate(new BigDecimal("4000.00"));
        booking.setBaseAmount(new BigDecimal("12000.00"));
        booking.setDepositAmount(new BigDecimal("10000.00"));
        booking.setTotalAmount(new BigDecimal("22000.00"));
        booking.setStatus(status);
        return booking;
    }

    /** Principal with an explicit id so the role-dispatch branch is deterministic. */
    private UserPrincipal principal(Role role, Long id) {
        return new UserPrincipal(
            id,
            role == Role.FLEET_MANAGER ? fleetManager.getEmail() : customer.getEmail(),
            "hash",
            role,
            true,
            role == Role.FLEET_MANAGER ? "Riya Kulkarni" : "Dev Sharma");
    }
}

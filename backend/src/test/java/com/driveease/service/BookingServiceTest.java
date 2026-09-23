package com.driveease.service;

import com.driveease.dto.booking.BookingCreateRequest;
import com.driveease.entity.*;
import com.driveease.exception.BookingConflictException;
import com.driveease.exception.InvalidBookingStateException;
import com.driveease.exception.VehicleUnavailableException;
import com.driveease.mapper.*;
import com.driveease.repository.*;
import com.driveease.util.ReferenceGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private ReferenceGenerator referenceGenerator;
    @Mock private BookingMapper bookingMapper;
    @Mock private PaymentMapper paymentMapper;
    @Mock private ReviewMapper reviewMapper;
    @Mock private VehicleMapper vehicleMapper;
    @Mock private RefundService refundService;

    @InjectMocks private BookingService bookingService;

    private AppPropertiesHolder propertiesHolder;
    private PricingService pricingService;
    private User customer;
    private Vehicle vehicle;

    /** Small holder so the pricing service can be built with the default limits. */
    private record AppPropertiesHolder(com.driveease.config.AppProperties value) {
    }

    @BeforeEach
    void setUp() {
        var properties = new com.driveease.config.AppProperties();
        propertiesHolder = new AppPropertiesHolder(properties);
        pricingService = new PricingService(properties);

        customer = new User();
        customer.setId(7L);
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

        bookingService = new BookingService(bookingRepository, vehicleRepository, userRepository, paymentRepository,
                reviewRepository, pricingService, notificationService, auditService, referenceGenerator,
                bookingMapper, paymentMapper, reviewMapper, vehicleMapper, refundService);

        when(userRepository.findById(7L)).thenReturn(Optional.of(customer));
        when(referenceGenerator.bookingReference(any())).thenReturn("DE-20261010-0001");
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            booking.setId(99L);
            return booking;
        });
        when(paymentRepository.findByBookingId(anyLong())).thenReturn(List.of());
        when(reviewRepository.findByBookingId(anyLong())).thenReturn(Optional.empty());
        when(refundService.refundedTotalForBooking(anyLong())).thenReturn(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("an overlapping reservation is rejected with 409 and never persisted")
    void rejectsOverlappingBooking() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        LocalDate drop = pickup.plusDays(4);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.countOverlapping(eq(11L), eq(pickup), eq(drop), isNull())).thenReturn(1L);

        assertThatThrownBy(() -> bookingService.create(7L, new BookingCreateRequest(11L, pickup, drop,
                "Mangaluru", "Mangaluru", null)))
                .isInstanceOf(BookingConflictException.class)
                .hasMessageContaining("already reserved");

        verify(bookingRepository, never()).save(any(Booking.class));
    }

    @Test
    @DisplayName("a free window creates a PENDING booking priced by the pricing service")
    void createsBookingWhenWindowIsFree() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        LocalDate drop = pickup.plusDays(4);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.countOverlapping(eq(11L), eq(pickup), eq(drop), isNull())).thenReturn(0L);

        bookingService.create(7L, new BookingCreateRequest(11L, pickup, drop, "Mangaluru", "Mangaluru", "Airport run"));

        var captor = org.mockito.ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        Booking saved = captor.getValue();

        assertThat(saved.getStatus()).isEqualTo(BookingStatus.PENDING);
        assertThat(saved.getTotalDays()).isEqualTo(4);
        assertThat(saved.getBaseAmount()).isEqualByComparingTo("16000.00");
        assertThat(saved.getDepositAmount()).isEqualByComparingTo("10000.00");
        assertThat(saved.getTotalAmount()).isEqualByComparingTo("26000.00");
        assertThat(saved.getVehicle()).isSameAs(vehicle);
        // The vehicle is deliberately left AVAILABLE until the physical pickup (PRD EPIC-03).
        verify(vehicleRepository, never()).save(any(Vehicle.class));
    }

    @Test
    @DisplayName("a retired or servicing vehicle cannot be booked")
    void rejectsUnavailableVehicles() {
        LocalDate pickup = LocalDate.now().plusDays(5);
        vehicle.setStatus(VehicleStatus.MAINTENANCE);
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));

        assertThatThrownBy(() -> bookingService.create(7L, new BookingCreateRequest(11L, pickup, pickup.plusDays(2),
                "Mangaluru", "Mangaluru", null)))
                .isInstanceOf(VehicleUnavailableException.class)
                .hasMessageContaining("maintenance");

        verify(bookingRepository, never()).save(any(Booking.class));
    }

    @Test
    @DisplayName("pickup moves CONFIRMED to ACTIVE and the vehicle to RENTED")
    void pickupStartsTheRental() {
        Booking booking = booking(BookingStatus.CONFIRMED);
        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateStatus(99L, new com.driveease.dto.booking.BookingStatusUpdateRequest(
                BookingStatus.ACTIVE, 30_120, "Handed over at the airport desk"), principal(Role.FLEET_MANAGER));

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.RENTED);
        assertThat(booking.getActualPickupDate()).isNotNull();
        assertThat(booking.getMileageOut()).isEqualTo(30_120);
        verify(notificationService).onBookingActive(booking);
    }

    @Test
    @DisplayName("return moves ACTIVE to COMPLETED and frees the vehicle")
    void returnCompletesTheRental() {
        Booking booking = booking(BookingStatus.ACTIVE);
        vehicle.setStatus(VehicleStatus.RENTED);
        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));
        when(vehicleRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(vehicle));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bookingService.updateStatus(99L, new com.driveease.dto.booking.BookingStatusUpdateRequest(
                BookingStatus.COMPLETED, 30_890, null), principal(Role.FLEET_MANAGER));

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
        assertThat(booking.getActualReturnDate()).isNotNull();
        assertThat(vehicle.getMileage()).isEqualTo(30_890);
        verify(notificationService).onBookingCompleted(booking);
    }

    @Test
    @DisplayName("skipping states is rejected with 409 INVALID_BOOKING_STATE")
    void rejectsIllegalTransitions() {
        Booking booking = booking(BookingStatus.PENDING);
        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> bookingService.updateStatus(99L,
                new com.driveease.dto.booking.BookingStatusUpdateRequest(BookingStatus.ACTIVE, null, null),
                principal(Role.FLEET_MANAGER)))
                .isInstanceOf(InvalidBookingStateException.class)
                .hasMessageContaining("PENDING to ACTIVE");
    }

    @Test
    @DisplayName("a completed rental cannot be cancelled")
    void rejectsCancellingCompletedRental() {
        Booking booking = booking(BookingStatus.COMPLETED);
        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> bookingService.cancel(99L, principal(Role.CUSTOMER), "changed my mind"))
                .isInstanceOf(InvalidBookingStateException.class);
    }

    @Test
    @DisplayName("cancelling a paid booking triggers a refund")
    void cancellationRefundsPaidBookings() {
        Booking booking = booking(BookingStatus.CONFIRMED);
        Payment payment = new Payment();
        payment.setId(5L);
        payment.setBooking(booking);
        payment.setAmount(new BigDecimal("26000.00"));
        payment.setStatus(PaymentStatus.SUCCESS);

        when(bookingRepository.findDetailById(99L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentRepository.findByBookingIdAndStatus(99L, PaymentStatus.SUCCESS)).thenReturn(List.of(payment));

        bookingService.cancel(99L, principal(Role.CUSTOMER), "Plans changed");

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        verify(refundService).refundOnCancellation(payment, "Cancellation: Plans changed");
        verify(notificationService).onBookingCancelled(booking, "Plans changed");
    }

    private Booking booking(BookingStatus status) {
        Booking booking = new Booking();
        booking.setId(99L);
        booking.setBookingReference("DE-20261010-0001");
        booking.setUser(customer);
        booking.setVehicle(vehicle);
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

    private com.driveease.security.UserPrincipal principal(Role role) {
        return new com.driveease.security.UserPrincipal(7L, customer.getEmail(), "hash", role, true, "Dev Sharma");
    }
}

package com.driveease.bootstrap;

import com.driveease.entity.*;
import com.driveease.repository.*;
import com.driveease.service.PricingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Demo data for local development and the portfolio demo.
 *
 * <p>Two fleet partners are seeded so cross-fleet isolation can be demonstrated:
 * vehicles alternate between them, and their bookings are scoped accordingly.</p>
 */
@Service
public class DemoDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final String DEMO_PASSWORD = "Passw0rd!";

    private final UserRepository users;
    private final VehicleRepository vehicles;
    private final VehicleImageRepository images;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final ReviewRepository reviews;
    private final MaintenanceRecordRepository maintenance;
    private final DamageRecordRepository damage;
    private final PasswordEncoder encoder;

    public DemoDataSeeder(UserRepository users,
                          VehicleRepository vehicles,
                          VehicleImageRepository images,
                          BookingRepository bookings,
                          PaymentRepository payments,
                          ReviewRepository reviews,
                          MaintenanceRecordRepository maintenance,
                          DamageRecordRepository damage,
                          PasswordEncoder encoder) {
        this.users = users;
        this.vehicles = vehicles;
        this.images = images;
        this.bookings = bookings;
        this.payments = payments;
        this.reviews = reviews;
        this.maintenance = maintenance;
        this.damage = damage;
        this.encoder = encoder;
    }

    @Transactional
    public void seed() {
        if (users.count() > 0 || vehicles.count() > 0) {
            log.info("Demo data already present - skipping seed.");
            return;
        }

        User admin = user("admin@driveease.app", "Aarav", "Menon", Role.ADMIN,
            "+91 98200 11223", "DL-KA-2018-0099123", "Mangaluru");

        // Two fleet partners so multi-fleet ownership can be demonstrated.
        User fleetA = user("fleet@driveease.app", "Riya", "Kulkarni", Role.FLEET_MANAGER,
            "+91 98200 44556", "DL-KA-2019-0044321", "Bengaluru");
        User fleetB = user("fleetb@driveease.app", "Karan", "Shetty", Role.FLEET_MANAGER,
            "+91 98200 66778", "DL-KA-2019-0055432", "Mangaluru");

        User customer = user("customer@driveease.app", "Dev", "Sharma", Role.CUSTOMER,
            "+91 98200 77889", "DL-KA-2020-0077788", "Mangaluru");
        User priya = user("priya@driveease.app", "Priya", "Nair", Role.CUSTOMER,
            "+91 98200 33445", "DL-KA-2021-0055667", "Bengaluru");

        // Vehicles alternate owners. Odd index -> fleetA, even index -> fleetB.
        List<Vehicle> fleet = new ArrayList<>();
        User[] owners = { fleetA, fleetB };
        int ownerCursor = 0;

        Object[][] specs = {
            {"Toyota", "Camry Hybrid", 2023, VehicleCategory.LUXURY, "KA-19-MC-4821",
                "4250.00", "15000.00", FuelType.HYBRID, Transmission.AUTOMATIC, 5, 4, "Mangaluru", 28450,
                "A silent, effortless cruiser with adaptive cruise control and a genuinely calm cabin.",
                "Adaptive Cruise Control, Leather Seats, Apple CarPlay, 360 Camera, Ventilated Seats"},
            {"Mahindra", "XUV700", 2023, VehicleCategory.SUV, "KA-19-MX-7734",
                "3600.00", "12000.00", FuelType.DIESEL, Transmission.AUTOMATIC, 7, 5, "Mangaluru", 41200,
                "Seven seats, all-wheel drive and a panoramic roof for long highway days.",
                "All Wheel Drive, Panoramic Sunroof, ADAS, 7 Seats, Roof Rails"},
            {"Hyundai", "i20", 2022, VehicleCategory.COMPACT, "KA-19-MC-2210",
                "1900.00", "7000.00", FuelType.PETROL, Transmission.MANUAL, 5, 5, "Bengaluru", 52600,
                "Fuss-free city hatch that fits anywhere and sips fuel.",
                "Bluetooth Audio, Rear Camera, Cruise Control"},
            {"Tata", "Nexon EV", 2024, VehicleCategory.SUV, "KA-19-EV-1102",
                "3100.00", "10000.00", FuelType.ELECTRIC, Transmission.AUTOMATIC, 5, 5, "Bengaluru", 18900,
                "312 km real-world range with fast charging along the coastal highway.",
                "Fast Charging, Sunroof, Connected Car Tech, 5 Star Safety"},
            {"Toyota", "Innova Crysta", 2022, VehicleCategory.VAN, "KA-19-MV-5566",
                "3900.00", "12000.00", FuelType.DIESEL, Transmission.MANUAL, 7, 5, "Mangaluru", 63400,
                "The default choice for family trips and airport runs.",
                "Captain Seats, Rear AC Vents, 7 Seats, Large Luggage Space"},
            {"Maruti Suzuki", "Baleno", 2023, VehicleCategory.ECONOMY, "KA-19-MB-9033",
                "1500.00", "5000.00", FuelType.PETROL, Transmission.AUTOMATIC, 5, 5, "Bengaluru", 22800,
                "Light, efficient and easy to park - ideal for short city rentals.",
                "Auto Climate Control, Apple CarPlay, Rear Camera"},
            {"Kia", "Seltos", 2023, VehicleCategory.SUV, "KA-19-MK-6688",
                "3300.00", "11000.00", FuelType.PETROL, Transmission.AUTOMATIC, 5, 5, "Mangaluru", 31700,
                "Sharp handling with a premium cabin and Bose audio.",
                "Bose Audio, Ventilated Seats, 360 Camera, Sunroof"},
            {"Mercedes-Benz", "E-Class", 2023, VehicleCategory.LUXURY, "KA-19-ME-0007",
                "9800.00", "40000.00", FuelType.PETROL, Transmission.AUTOMATIC, 5, 4, "Mangaluru", 12400,
                "Chauffeur-grade comfort with air suspension and Burmester sound.",
                "Air Suspension, Burmester Audio, Massage Seats, Ambient Lighting"},
            {"Honda", "City", 2022, VehicleCategory.COMPACT, "KA-19-MH-3344",
                "2100.00", "8000.00", FuelType.PETROL, Transmission.AUTOMATIC, 5, 5, "Bengaluru", 44300,
                "Comfortable sedan with a famously smooth automatic gearbox.",
                "CVT Automatic, Rear AC Vents, Cruise Control"},
            {"MG", "ZS EV", 2024, VehicleCategory.SUV, "KA-19-EV-2255",
                "3400.00", "12000.00", FuelType.ELECTRIC, Transmission.AUTOMATIC, 5, 5, "Mangaluru", 9800,
                "Quiet electric SUV with a panoramic roof and quick charging.",
                "Panoramic Roof, Fast Charging, Connected Car Tech, 6 Airbags"},
        };

        for (Object[] s : specs) {
            User owner = owners[ownerCursor % owners.length];
            ownerCursor++;
            fleet.add(vehicle(owner,
                (String) s[0], (String) s[1], (Integer) s[2], (VehicleCategory) s[3], (String) s[4],
                (String) s[5], (String) s[6], (FuelType) s[7], (Transmission) s[8],
                (Integer) s[9], (Integer) s[10], (String) s[11], (Integer) s[12],
                (String) s[13], (String) s[14]));
        }

        Vehicle inWorkshop = fleet.get(5);
        inWorkshop.setStatus(VehicleStatus.MAINTENANCE);
        vehicles.save(inWorkshop);

        MaintenanceRecord service = new MaintenanceRecord();
        service.setVehicle(inWorkshop);
        service.setType(MaintenanceType.SERVICE);
        service.setDescription("60,000 km service: engine oil, filters, brake fluid and wheel alignment.");
        service.setScheduledDate(LocalDate.now().plusDays(2));
        service.setCost(new BigDecimal("7800.00"));
        service.setStatus(MaintenanceStatus.SCHEDULED);
        service.setGarage("Maruti Authorised Service - Kadri");
        service.setOdometerReading(22800);
        service.setCreatedBy(fleetA.getId());
        maintenance.save(service);

        Vehicle retired = fleet.get(8);
        retired.setStatus(VehicleStatus.RETIRED);
        retired.setRetireReason("Depot transfer - vehicle moved to the Kochi franchise.");
        retired.setRetiredAt(LocalDateTime.now());
        vehicles.save(retired);

        LocalDate today = LocalDate.now();
        Booking completed = booking(customer, fleet.get(0), today.minusDays(44), today.minusDays(41),
            "Mangaluru", "Mangaluru", BookingStatus.COMPLETED, "Coastal highway weekend trip.");
        Booking completedTwo = booking(priya, fleet.get(0), today.minusDays(18), today.minusDays(14),
            "Mangaluru", "Mangaluru", BookingStatus.COMPLETED, null);
        Booking active = booking(priya, fleet.get(1), today.minusDays(2), today.plusDays(2),
            "Bengaluru", "Mangaluru", BookingStatus.ACTIVE, "Family holiday, one-way drop in Mangaluru.");
        Booking confirmed = booking(customer, fleet.get(3), today.plusDays(6), today.plusDays(9),
            "Mangaluru", "Mangaluru", BookingStatus.CONFIRMED, "Airport pickup, 7:30 am.");
        booking(priya, fleet.get(6), today.plusDays(12), today.plusDays(15),
            "Mangaluru", "Bengaluru", BookingStatus.PENDING, "Awaiting corporate approval.");

        approve(completed, PaymentMethod.CREDIT_CARD, "4242", today.minusDays(46));
        approve(completedTwo, PaymentMethod.DEBIT_CARD, "9012", today.minusDays(20));
        approve(active, PaymentMethod.UPI, null, today.minusDays(4));
        approve(confirmed, PaymentMethod.CREDIT_CARD, "1881", today.minusDays(1));

        review(customer, fleet.get(0), completed, 5, "Effortless highway cruiser",
            "Spotless car, full tank, and the hybrid returned 18 km/l on the ghats. Handover took ten minutes.");
        review(priya, fleet.get(0), completedTwo, 4, "Comfortable, thirsty in traffic",
            "Great ride quality and a genuinely quiet cabin. City traffic dropped it to 11 km/l.");

        DamageRecord damageRecord = new DamageRecord();
        damageRecord.setVehicle(fleet.get(1));
        damageRecord.setBooking(active);
        damageRecord.setDescription("Rear bumper scuff noticed during the pre-handover inspection.");
        damageRecord.setSeverity(DamageSeverity.MINOR);
        damageRecord.setLocationOnVehicle("Rear bumper, left corner");
        damageRecord.setRepairEstimate(new BigDecimal("6500.00"));
        damageRecord.setStatus(DamageStatus.REPORTED);
        damageRecord.setReportedBy(fleetB.getId());
        damage.save(damageRecord);

        Vehicle rented = fleet.get(1);
        rented.setStatus(VehicleStatus.RENTED);
        vehicles.save(rented);

        log.info("""

                ────────────────────── DriveEase demo data ──────────────────────
                  admin@driveease.app     / {}   (ADMIN)
                  fleet@driveease.app     / {}   (FLEET_MANAGER, owns odd vehicles)
                  fleetb@driveease.app    / {}   (FLEET_MANAGER, owns even vehicles)
                  customer@driveease.app  / {}   (CUSTOMER)
                  priya@driveease.app     / {}   (CUSTOMER)
                  seeded: {} users, {} vehicles, {} bookings
                ─────────────────────────────────────────────────────────────────
                """, DEMO_PASSWORD, DEMO_PASSWORD, DEMO_PASSWORD, DEMO_PASSWORD, DEMO_PASSWORD,
            users.count(), vehicles.count(), bookings.count());
    }

    private User user(String email, String first, String last, Role role,
                      String phone, String licence, String city) {
        User existing = users.findByEmailIgnoreCase(email).orElse(null);
        if (existing != null) {
            return existing;
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(DEMO_PASSWORD));
        user.setFirstName(first);
        user.setLastName(last);
        user.setPhone(phone);
        user.setLicenseNo(licence);
        user.setCity(city);
        user.setAddress("DriveEase demo account, " + city);
        user.setRole(role);
        user.setActive(true);
        return users.save(user);
    }

    private Vehicle vehicle(User owner, String make, String model, int year, VehicleCategory category, String plate,
                            String dailyRate, String deposit, FuelType fuel, Transmission transmission,
                            int seats, int doors, String location, int odometer,
                            String description, String features) {
        Vehicle vehicle = new Vehicle();
        vehicle.setMake(make);
        vehicle.setModel(model);
        vehicle.setYear(year);
        vehicle.setCategory(category);
        vehicle.setLicensePlate(plate);
        vehicle.setVin("VIN" + plate.replace("-", ""));
        vehicle.setDailyRate(new BigDecimal(dailyRate));
        vehicle.setDepositAmount(new BigDecimal(deposit));
        vehicle.setFuelType(fuel);
        vehicle.setTransmission(transmission);
        vehicle.setSeats(seats);
        vehicle.setDoors(doors);
        vehicle.setLocation(location);
        vehicle.setMileage(odometer);
        vehicle.setDescription(description);
        vehicle.setFeatures(features);
        vehicle.setStatus(VehicleStatus.AVAILABLE);
        vehicle.setOwner(owner);   // ← the ownership link the whole model depends on
        String[] gallery = galleryFor(make, model);
        if (gallery.length > 0) vehicle.setImageUrl(gallery[0]);

        Vehicle saved = vehicles.save(vehicle);
        for (int i = 0; i < gallery.length; i++) {
            VehicleImage image = new VehicleImage();
            image.setVehicle(saved);
            image.setUrl(gallery[i]);
            image.setAltText(make + " " + model + " - view " + (i + 1));
            image.setDisplayOrder(i);
            image.setPrimary(i == 0);
            images.save(image);
        }
        return saved;
    }

    private String[] galleryFor(String make, String model) {
        String slug = (make + "-" + model).toLowerCase().replace(" ", "-").replace(".", "");
        return new String[]{
            "/images/vehicles/" + slug + "-1.svg",
            "/images/vehicles/" + slug + "-2.svg",
            "/images/vehicles/" + slug + "-3.svg"};
    }

    private Booking booking(User user, Vehicle vehicle, LocalDate pickup, LocalDate ret,
                            String pickupLocation, String returnLocation, BookingStatus status, String notes) {
        int days = (int) ChronoUnit.DAYS.between(pickup, ret);
        BigDecimal base = PricingService.money(vehicle.getDailyRate().multiply(BigDecimal.valueOf(days)));
        Booking booking = new Booking();
        booking.setBookingReference("DE-%s-%04d".formatted(
            pickup.toString().replace("-", ""),
            Math.floorMod(vehicle.getId() * 137 + days * 11 + (int) users.count(), 10000)));
        booking.setUser(user);
        booking.setVehicle(vehicle);
        booking.setOwnerFleet(vehicle.getOwner());   // ← derived from the vehicle, never from input
        booking.setPickupDate(pickup);
        booking.setReturnDate(ret);
        booking.setPickupLocation(pickupLocation);
        booking.setReturnLocation(returnLocation);
        booking.setTotalDays(days);
        booking.setDailyRate(vehicle.getDailyRate());
        booking.setBaseAmount(base);
        booking.setDepositAmount(vehicle.getDepositAmount());
        booking.setTotalAmount(PricingService.money(base.add(vehicle.getDepositAmount())));
        booking.setStatus(status);
        booking.setNotes(notes);
        if (status == BookingStatus.ACTIVE || status == BookingStatus.COMPLETED) {
            booking.setActualPickupDate(pickup.atTime(10, 0));
            booking.setMileageOut(vehicle.getMileage());
        }
        if (status == BookingStatus.COMPLETED) {
            booking.setActualReturnDate(ret.atTime(18, 30));
            booking.setMileageIn(vehicle.getMileage() == null ? null : vehicle.getMileage() + 640);
        }
        return bookings.save(booking);
    }

    private void approve(Booking booking, PaymentMethod method, String cardLast4, LocalDate createdOn) {
        Payment payment = new Payment();
        payment.setPaymentReference("DE-PAY-%s-%04d".formatted(
            createdOn.toString().replace("-", ""),
            Math.floorMod(booking.getId() * 91 + (int) payments.count(), 10000)));
        payment.setBooking(booking);
        payment.setUser(booking.getUser());
        payment.setAmount(booking.getTotalAmount());
        payment.setCurrency("INR");
        payment.setPaymentMethod(method);
        payment.setCardLast4(cardLast4);
        payment.setTransactionRef("DE-TXN-SEED%06d".formatted(booking.getId()));
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaidAt(createdOn.atTime(9, 30));
        payments.save(payment);
    }

    private void review(User user, Vehicle vehicle, Booking booking, int rating, String title, String comment) {
        Review review = new Review();
        review.setUser(user);
        review.setVehicle(vehicle);
        review.setBooking(booking);
        review.setRating(rating);
        review.setTitle(title);
        review.setComment(comment);
        reviews.save(review);
    }
}

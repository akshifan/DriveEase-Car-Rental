package com.driveease.service;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.common.PageResponse;
import com.driveease.dto.vehicle.*;
import com.driveease.entity.*;
import com.driveease.exception.*;
import com.driveease.mapper.BookingMapper;
import com.driveease.mapper.VehicleMapper;
import com.driveease.repository.*;
import com.driveease.repository.spec.VehicleSpecifications;
import com.driveease.security.UserPrincipal;
import com.driveease.util.CsvWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** Catalogue search, fleet vehicle management and retirement (PRD EPIC-02). */
@Service
public class VehicleService {

    private static final Logger log = LoggerFactory.getLogger(VehicleService.class);

    private final VehicleRepository vehicleRepository;
    private final VehicleImageRepository vehicleImageRepository;
    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;
    private final MaintenanceRecordRepository maintenanceRepository;
    private final DamageRecordRepository damageRepository;
    private final VehicleMapper vehicleMapper;
    private final BookingMapper bookingMapper;
    private final AuditService auditService;

    public VehicleService(VehicleRepository vehicleRepository,
                          VehicleImageRepository vehicleImageRepository,
                          BookingRepository bookingRepository,
                          ReviewRepository reviewRepository,
                          MaintenanceRecordRepository maintenanceRepository,
                          DamageRecordRepository damageRepository,
                          VehicleMapper vehicleMapper,
                          BookingMapper bookingMapper,
                          AuditService auditService) {
        this.vehicleRepository = vehicleRepository;
        this.vehicleImageRepository = vehicleImageRepository;
        this.bookingRepository = bookingRepository;
        this.reviewRepository = reviewRepository;
        this.maintenanceRepository = maintenanceRepository;
        this.damageRepository = damageRepository;
        this.vehicleMapper = vehicleMapper;
        this.bookingMapper = bookingMapper;
        this.auditService = auditService;
    }

    // ------------------------------------------------------------------ search

    /**
     * Server-side catalogue search (PRD US-02-01/02): every filter is pushed into
     * the database through a JPA Specification, availability is a NOT EXISTS
     * sub-query and pagination/sorting are applied by the database.
     */
    @Transactional(readOnly = true)
    public PageResponse<VehicleResponse> search(LocalDate pickupDate, LocalDate returnDate, String location,
                                                VehicleCategory category, FuelType fuelType,
                                                Transmission transmission, BigDecimal minPrice, BigDecimal maxPrice,
                                                Integer minSeats, String search, VehicleStatus status,
                                                boolean includeUnavailable, Pageable pageable) {
        boolean dateFilter = pickupDate != null && returnDate != null;
        if (dateFilter && !returnDate.isAfter(pickupDate)) {
            throw InvalidRequestException.unprocessable("INVALID_DATE_RANGE",
                    "The return date must be after the pickup date.");
        }

        Specification<Vehicle> spec = Specification.allOf(
                VehicleSpecifications.notRetired(),
                includeUnavailable ? null : VehicleSpecifications.bookableOnly(false),
                VehicleSpecifications.hasStatus(includeUnavailable ? status : null),
                VehicleSpecifications.hasLocation(location),
                VehicleSpecifications.hasCategory(category),
                VehicleSpecifications.hasFuelType(fuelType),
                VehicleSpecifications.hasTransmission(transmission),
                VehicleSpecifications.minPrice(minPrice),
                VehicleSpecifications.maxPrice(maxPrice),
                VehicleSpecifications.minSeats(minSeats),
                VehicleSpecifications.matchesText(search),
                dateFilter ? VehicleSpecifications.availableBetween(pickupDate, returnDate) : null);

        Page<Vehicle> page = vehicleRepository.findAll(spec, pageable);
        Map<Long, Double> ratings = ratingsFor(page.getContent());
        Map<Long, Long> counts = reviewCountsFor(page.getContent());
        Map<Long, String> covers = primaryImagesFor(page.getContent());
        return PageResponse.of(page, vehicle -> vehicleMapper.toResponse(vehicle,
                ratings.get(vehicle.getId()), counts.get(vehicle.getId()),
                covers.get(vehicle.getId())));
    }

    /** Cover image for one page of vehicles in a single query - falls back to the primary gallery shot. */
    private Map<Long, String> primaryImagesFor(List<Vehicle> vehicles) {
        if (vehicles.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> map = new HashMap<>();
        for (VehicleImage image : vehicleImageRepository.findByVehicleIdInAndPrimaryTrue(
                vehicles.stream().map(Vehicle::getId).toList())) {
            map.putIfAbsent(image.getVehicle().getId(), image.getUrl());
        }
        return map;
    }

    /** Ratings for one page of vehicles in a single grouped query - no N+1. */
    private Map<Long, Double> ratingsFor(List<Vehicle> vehicles) {
        Map<Long, Double> map = new HashMap<>();
        if (vehicles.isEmpty()) {
            return map;
        }
        for (Object[] row : reviewRepository.averageRatingsByVehicleIds(
                vehicles.stream().map(Vehicle::getId).toList())) {
            map.put((Long) row[0], VehicleMapper.round(((Number) row[1]).doubleValue()));
        }
        return map;
    }

    /** Review counts for one page of vehicles in a single grouped query - no N+1. */
    private Map<Long, Long> reviewCountsFor(List<Vehicle> vehicles) {
        Map<Long, Long> map = new HashMap<>();
        if (vehicles.isEmpty()) {
            return map;
        }
        for (Object[] row : reviewRepository.countsByVehicleIds(
                vehicles.stream().map(Vehicle::getId).toList())) {
            map.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }

    @Transactional(readOnly = true)
    public VehicleDetailResponse detail(Long id, LocalDate pickupDate, LocalDate returnDate) {
        Vehicle vehicle = vehicleRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id));
        if (vehicle.getStatus() == VehicleStatus.RETIRED) {
            throw new ResourceNotFoundException("Vehicle " + id + " is no longer part of the fleet.");
        }

        List<VehicleImage> images = vehicle.getImages();
        if (images.isEmpty() && vehicle.getImageUrl() != null) {
            images = vehicleImageRepository.findByVehicleIdOrderByDisplayOrderAsc(id);
        }

        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            distribution.put(star, 0L);
        }
        for (Object[] row : reviewRepository.ratingBreakdown(id)) {
            distribution.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }

        List<Booking> bookings = bookingRepository.findByVehicleIdWithVehicle(id);
        List<Booking> blocking = bookings.stream()
                .filter(b -> b.getStatus().holdsVehicle() && !b.getReturnDate().isBefore(LocalDate.now()))
                .sorted(Comparator.comparing(Booking::getPickupDate))
                .toList();

        String unavailableReason = switch (vehicle.getStatus()) {
            case RETIRED -> "This vehicle has been retired from the fleet.";
            case MAINTENANCE -> "This vehicle is in the workshop for scheduled maintenance.";
            case RENTED -> "Currently on rent. Check the availability windows below.";
            case AVAILABLE -> null;
        };

        List<VehicleDetailResponse.VehicleAvailabilityWindow> windows = blocking.stream()
                .map(b -> new VehicleDetailResponse.VehicleAvailabilityWindow(b.getPickupDate(), b.getReturnDate()))
                .toList();

        Double average = reviewRepository.averageRating(id);
        long reviewCount = reviewRepository.countByVehicle(id);

        return new VehicleDetailResponse(
                vehicle.getId(), vehicle.getMake(), vehicle.getModel(), vehicle.displayName(), vehicle.getYear(),
                vehicle.getCategory(), vehicle.getLicensePlate(), vehicle.getVin(), vehicle.getDailyRate(),
                vehicle.getDepositAmount(), vehicle.getStatus(), vehicle.getLocation(), vehicle.getMileage(),
                vehicle.getSeats(), vehicle.getDoors(), vehicle.getFuelType(), vehicle.getTransmission(),
                vehicle.getImageUrl(), vehicle.getDescription(), vehicle.featureList(),
                vehicleMapper.toImageResponses(images),
                vehicle.getStatus().isBookable(),
                unavailableReason,
                average == null ? 0d : VehicleMapper.round(average),
                reviewCount,
                distribution,
                blocking.size(),
                nextAvailableFrom(blocking),
                windows,
                vehicle.getCreatedAt(),
                vehicle.getUpdatedAt());
    }

    private LocalDate nextAvailableFrom(List<Booking> blocking) {
        if (blocking.isEmpty()) {
            return LocalDate.now();
        }
        LocalDate today = LocalDate.now();
        LocalDate cursor = today;
        for (Booking booking : blocking) {
            if (booking.getPickupDate().isAfter(cursor)) {
                return cursor;
            }
            cursor = booking.getReturnDate();
        }
        return cursor;
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> availability(Long vehicleId, Pageable pageable) {
        List<Booking> bookings = bookingRepository.findByVehicleIdWithVehicle(vehicleId);
        List<BookingResponse> blocking = bookings.stream()
                .filter(b -> b.getStatus().holdsVehicle() && !b.getReturnDate().isBefore(LocalDate.now()))
                .sorted(Comparator.comparing(Booking::getPickupDate))
                .map(b -> bookingMapper.toResponse(b, null, false))
                .toList();
        int size = pageable.getPageSize();
        int from = Math.min(pageable.getPageNumber() * size, blocking.size());
        int to = Math.min(from + size, blocking.size());
        List<BookingResponse> slice = blocking.subList(from, to);
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) blocking.size() / size);
        return new PageResponse<>(slice, pageable.getPageNumber(), size, blocking.size(), totalPages,
                pageable.getPageNumber() == 0, to >= blocking.size(), slice.isEmpty());
    }

    @Transactional(readOnly = true)
    public List<String> locations() {
        return vehicleRepository.findActiveLocations();
    }

    /** Category rollup for the catalogue filter rail - aggregated by PostgreSQL, not in Java. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> categories() {
        Map<VehicleCategory, Object[]> aggregates = new EnumMap<>(VehicleCategory.class);
        for (Object[] row : vehicleRepository.categorySummary()) {
            aggregates.put((VehicleCategory) row[0], row);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (VehicleCategory category : VehicleCategory.values()) {
            Object[] row = aggregates.get(category);
            result.add(Map.of(
                    "category", category,
                    "label", prettify(category),
                    "vehicleCount", row == null ? 0L : ((Number) row[2]).longValue(),
                    "startingFrom", row == null ? BigDecimal.ZERO : PricingService.money((BigDecimal) row[1])));
        }
        return result;
    }

    private String prettify(Enum<?> value) {
        String lower = value.name().toLowerCase().replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    // ------------------------------------------------------------- fleet admin

    @Transactional
    public VehicleResponse create(VehicleCreateRequest request) {
        String plate = request.licensePlate().trim().toUpperCase();
        if (vehicleRepository.existsByLicensePlateIgnoreCase(plate)) {
            throw new DuplicateResourceException("LICENSE_PLATE_EXISTS",
                    "A vehicle with registration " + plate + " already exists in the fleet.");
        }
        Vehicle vehicle = new Vehicle();
        applyCreate(vehicle, request, plate);
        Vehicle saved = vehicleRepository.save(vehicle);
        replaceGallery(saved, request.galleryUrls(), request.imageUrl());
        auditService.record(AuditAction.VEHICLE_CREATED, "Vehicle", saved.getId(),
                "Vehicle added: " + saved.displayName() + " (" + saved.getLicensePlate() + ")",
                "dailyRate=" + saved.getDailyRate() + ", location=" + saved.getLocation());
        log.info("Vehicle {} added to fleet", saved.getLicensePlate());
        return vehicleMapper.toResponse(saved, 0d, 0L);
    }

    private void applyCreate(Vehicle vehicle, VehicleCreateRequest request, String plate) {
        vehicle.setMake(request.make().trim());
        vehicle.setModel(request.model().trim());
        vehicle.setYear(request.year());
        vehicle.setCategory(request.category());
        vehicle.setLicensePlate(plate);
        vehicle.setVin(blankToNull(request.vin()));
        vehicle.setDailyRate(PricingService.money(request.dailyRate()));
        vehicle.setDepositAmount(PricingService.money(
                request.depositAmount() == null ? BigDecimal.ZERO : request.depositAmount()));
        vehicle.setLocation(blankToNull(request.location()));
        vehicle.setMileage(request.mileage());
        vehicle.setSeats(request.seats());
        vehicle.setDoors(request.doors());
        vehicle.setFuelType(request.fuelType());
        vehicle.setTransmission(request.transmission());
        vehicle.setImageUrl(blankToNull(request.imageUrl()));
        vehicle.setDescription(blankToNull(request.description()));
        vehicle.setFeatures(joinFeatures(request.features()));
        vehicle.setStatus(VehicleStatus.AVAILABLE);
    }

    @Transactional
    public VehicleResponse update(Long id, VehicleUpdateRequest request) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id));

        if (request.licensePlate() != null && !request.licensePlate().isBlank()) {
            String plate = request.licensePlate().trim().toUpperCase();
            vehicleRepository.findByLicensePlateIgnoreCase(plate)
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(existing -> {
                        throw new DuplicateResourceException("LICENSE_PLATE_EXISTS",
                                "Registration " + plate + " already belongs to another vehicle.");
                    });
            vehicle.setLicensePlate(plate);
        }
        if (request.make() != null && !request.make().isBlank()) {
            vehicle.setMake(request.make().trim());
        }
        if (request.model() != null && !request.model().isBlank()) {
            vehicle.setModel(request.model().trim());
        }
        if (request.year() != null) {
            vehicle.setYear(request.year());
        }
        if (request.category() != null) {
            vehicle.setCategory(request.category());
        }
        if (request.vin() != null) {
            vehicle.setVin(blankToNull(request.vin()));
        }
        if (request.dailyRate() != null) {
            vehicle.setDailyRate(PricingService.money(request.dailyRate()));
        }
        if (request.depositAmount() != null) {
            vehicle.setDepositAmount(PricingService.money(request.depositAmount()));
        }
        if (request.location() != null) {
            vehicle.setLocation(blankToNull(request.location()));
        }
        if (request.mileage() != null) {
            vehicle.setMileage(request.mileage());
        }
        if (request.seats() != null) {
            vehicle.setSeats(request.seats());
        }
        if (request.doors() != null) {
            vehicle.setDoors(request.doors());
        }
        if (request.fuelType() != null) {
            vehicle.setFuelType(request.fuelType());
        }
        if (request.transmission() != null) {
            vehicle.setTransmission(request.transmission());
        }
        if (request.imageUrl() != null) {
            vehicle.setImageUrl(blankToNull(request.imageUrl()));
        }
        if (request.description() != null) {
            vehicle.setDescription(blankToNull(request.description()));
        }
        if (request.features() != null) {
            vehicle.setFeatures(joinFeatures(request.features()));
        }
        if (request.status() != null && request.status() != vehicle.getStatus()) {
            changeStatus(vehicle, request.status(), request.statusReason());
        }
        if (request.galleryUrls() != null) {
            replaceGallery(vehicle, request.galleryUrls(), vehicle.getImageUrl());
        }

        Vehicle saved = vehicleRepository.save(vehicle);
        auditService.record(AuditAction.VEHICLE_UPDATED, "Vehicle", saved.getId(),
                "Vehicle updated: " + saved.displayName(), "status=" + saved.getStatus());
        Double avg = reviewRepository.averageRating(id);
        return vehicleMapper.toResponse(saved, avg, reviewRepository.countByVehicle(id));
    }

    @Transactional
    public VehicleResponse changeStatus(Long id, VehicleStatusRequest request) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id));
        changeStatus(vehicle, request.status(), request.reason());
        Vehicle saved = vehicleRepository.save(vehicle);
        return vehicleMapper.toResponse(saved, reviewRepository.averageRating(id),
                reviewRepository.countByVehicle(id));
    }

    /** Enforces the vehicle state machine; retiring requires a reason and live rentals block it. */
    private void changeStatus(Vehicle vehicle, VehicleStatus target, String reason) {
        VehicleStatus current = vehicle.getStatus();
        if (!current.canTransitionTo(target)) {
            throw InvalidRequestException.unprocessable("INVALID_VEHICLE_TRANSITION",
                    "A vehicle cannot move from " + current + " to " + target + ".");
        }
        if (target == VehicleStatus.RETIRED) {
            if (reason == null || reason.isBlank()) {
                throw InvalidRequestException.unprocessable("RETIRE_REASON_REQUIRED",
                        "A reason is required to retire a vehicle.");
            }
            vehicle.setRetireReason(reason.trim());
            vehicle.setRetiredAt(java.time.LocalDateTime.now());
        }
        vehicle.setStatus(target);
        auditService.record(target == VehicleStatus.RETIRED ? AuditAction.VEHICLE_RETIRED
                        : AuditAction.VEHICLE_STATUS_CHANGED,
                "Vehicle", vehicle.getId(),
                "Vehicle " + vehicle.getLicensePlate() + ": " + current + " -> " + target,
                reason);
    }

    /** Administrative retire endpoint (DELETE /vehicles/{id}). */
    @Transactional
    public void retire(Long id, String reason) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id));
        if (vehicle.getStatus() == VehicleStatus.RENTED) {
            throw InvalidRequestException.unprocessable("VEHICLE_ON_RENT",
                    "This vehicle is currently on rent and cannot be retired until it is returned.");
        }
        long liveBookings = bookingRepository.countOverlapping(id, LocalDate.now(),
                LocalDate.now().plusYears(2), null);
        if (liveBookings > 0 && vehicle.getStatus() == VehicleStatus.AVAILABLE) {
            log.info("Retiring {} although {} upcoming booking(s) exist; existing bookings are honoured (PRD US-02-06).",
                    vehicle.getLicensePlate(), liveBookings);
        }
        changeStatus(vehicle, VehicleStatus.RETIRED, reason);
        vehicleRepository.save(vehicle);
    }

    private void replaceGallery(Vehicle vehicle, List<String> galleryUrls, String primaryUrl) {
        if (galleryUrls == null) {
            return;
        }
        vehicleImageRepository.deleteByVehicleId(vehicle.getId());
        List<String> urls = new ArrayList<>(galleryUrls.stream().filter(u -> u != null && !u.isBlank()).toList());
        if (urls.isEmpty() && primaryUrl != null && !primaryUrl.isBlank()) {
            urls.add(primaryUrl);
        }
        for (int i = 0; i < urls.size(); i++) {
            VehicleImage image = new VehicleImage();
            image.setVehicle(vehicle);
            image.setUrl(urls.get(i).trim());
            image.setAltText(vehicle.displayName() + " photo " + (i + 1));
            image.setDisplayOrder(i);
            image.setPrimary(i == 0);
            vehicleImageRepository.save(image);
        }
    }

    /** Fleet CSV export for fleet managers (vehicle state; financial reporting lives under /reports). */
    @Transactional(readOnly = true)
    public String exportFleetCsv() {
        List<Vehicle> vehicles = vehicleRepository.findAll(Sort.by("make", "model"));
        List<List<?>> rows = new ArrayList<>();
        for (Vehicle vehicle : vehicles) {
            long completed = bookingRepository.findByVehicleIdWithVehicle(vehicle.getId()).stream()
                    .filter(b -> b.getStatus() == BookingStatus.COMPLETED).count();
            Double average = reviewRepository.averageRating(vehicle.getId());
            rows.add(List.of(vehicle.getLicensePlate(), vehicle.displayName(), vehicle.getCategory(),
                    vehicle.getStatus(), vehicle.getLocation(), vehicle.getDailyRate(),
                    vehicle.getDepositAmount(), vehicle.getSeats(), vehicle.getFuelType(),
                    vehicle.getTransmission(),
                    vehicle.getMileage() == null ? "" : vehicle.getMileage(),
                    completed,
                    average == null ? "" : VehicleMapper.round(average)));
        }
        return CsvWriter.write(List.of("License Plate", "Vehicle", "Category", "Status", "Location",
                "Daily Rate", "Deposit", "Seats", "Fuel", "Transmission", "Mileage",
                "Completed Bookings", "Avg Rating"), rows);
    }

    @Transactional(readOnly = true)
    public Vehicle requireVehicle(Long id) {
        return vehicleRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Vehicle", id));
    }

    private String joinFeatures(List<String> features) {
        if (features == null || features.isEmpty()) {
            return null;
        }
        return features.stream()
                .filter(f -> f != null && !f.isBlank())
                .map(String::trim)
                .reduce((a, b) -> a + ", " + b)
                .orElse(null);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

package com.driveease.service;

import com.driveease.dto.report.RevenueReportResponse;
import com.driveease.dto.report.UtilisationReportResponse;
import com.driveease.entity.*;
import com.driveease.exception.InvalidRequestException;
import com.driveease.repository.*;
import com.driveease.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Reporting (PRD US-04-05 revenue, US-05-05 utilisation).
 * Every figure is aggregated by PostgreSQL; nothing is hard-coded and no
 * dashboard statistic is invented when the underlying data is empty.
 */
@Service
public class ReportService {

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final VehicleRepository vehicleRepository;

    public ReportService(PaymentRepository paymentRepository,
                         RefundRepository refundRepository,
                         BookingRepository bookingRepository,
                         VehicleRepository vehicleRepository) {
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.bookingRepository = bookingRepository;
        this.vehicleRepository = vehicleRepository;
    }

    @Transactional(readOnly = true)
    public RevenueReportResponse revenue(LocalDate from, LocalDate to, String groupBy, String category, String branch) {
        LocalDate start = from == null ? LocalDate.now().minusDays(29) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        if (end.isBefore(start)) {
            throw InvalidRequestException.unprocessable("INVALID_DATE_RANGE",
                "The end date must be on or after the start date.");
        }
        String grouping = normaliseGroupBy(groupBy);

        LocalDateTime fromTs = start.atStartOfDay();
        LocalDateTime toTs = end.plusDays(1).atStartOfDay();

        BigDecimal gross = nz(paymentRepository.sumCollected(fromTs, toTs));
        BigDecimal refunds = nz(refundRepository.sumRefundedBetween(fromTs, toTs));
        BigDecimal net = gross.subtract(refunds);

        long paidBookings = bookingRepository.countByStatus(BookingStatus.COMPLETED)
            + bookingRepository.countByStatus(BookingStatus.ACTIVE)
            + bookingRepository.countByStatus(BookingStatus.CONFIRMED);
        long cancelledBookings = bookingRepository.countByStatus(BookingStatus.CANCELLED);
        long pendingBookings = bookingRepository.countByStatus(BookingStatus.PENDING);
        long failedPayments = paymentRepository.countFailedBetween(fromTs, toTs);

        BigDecimal avgBookingValue = paidBookings == 0 ? BigDecimal.ZERO
            : net.divide(BigDecimal.valueOf(paidBookings), 2, RoundingMode.HALF_UP);

        Map<String, BigDecimal> refundsByDay = new HashMap<>();
        for (Object[] row : paymentRepository.dailyRefunds(fromTs, toTs)) {
            refundsByDay.put((String) row[0], toMoney(row[1]));
        }

        List<RevenueReportResponse.RevenuePoint> series = new ArrayList<>();
        if ("month".equals(grouping)) {
            for (Object[] row : paymentRepository.monthlyRevenue(fromTs, toTs)) {
                String bucket = (String) row[0];
                series.add(new RevenueReportResponse.RevenuePoint(bucket, monthLabel(bucket),
                    toMoney(row[1]), ((Number) row[2]).longValue(), sumRefundsForMonth(refundsByDay, bucket)));
            }
        } else if ("week".equals(grouping)) {
            for (Object[] row : paymentRepository.weeklyRevenue(fromTs, toTs)) {
                String bucket = (String) row[0];
                series.add(new RevenueReportResponse.RevenuePoint(bucket, weekLabel(bucket),
                    toMoney(row[1]), ((Number) row[2]).longValue(), sumRefundsForWeek(refundsByDay, bucket)));
            }
        } else if ("category".equals(grouping) || "branch".equals(grouping)) {
            // Categorical grouping: the series itself becomes the breakdown so charts plot the
            // requested dimension while byCategory / byBranch stay populated for tables.
            Map<String, BigDecimal> refundsByGroup =
                "category".equals(grouping) ? refundsByCategory(fromTs, toTs) : refundsByBranch(fromTs, toTs);
            List<Object[]> rows = "category".equals(grouping)
                ? paymentRepository.sumByCategory(fromTs, toTs)
                : paymentRepository.sumByBranch(fromTs, toTs);
            for (Object[] row : rows) {
                String bucket = "category".equals(grouping) ? ((Enum<?>) row[0]).name() : (String) row[0];
                BigDecimal refunded = refundsByGroup.getOrDefault(bucket, BigDecimal.ZERO);
                series.add(new RevenueReportResponse.RevenuePoint(bucket, humanise(bucket),
                    toMoney(row[1]), ((Number) row[2]).longValue(), refunded));
            }
        } else {
            for (Object[] row : paymentRepository.dailyRevenue(fromTs, toTs)) {
                String bucket = (String) row[0];
                series.add(new RevenueReportResponse.RevenuePoint(bucket, bucket,
                    toMoney(row[1]), ((Number) row[2]).longValue(),
                    refundsByDay.getOrDefault(bucket, BigDecimal.ZERO)));
            }
        }

        List<RevenueReportResponse.RevenueGroup> byCategory = new ArrayList<>();
        for (Object[] row : paymentRepository.sumByCategory(fromTs, toTs)) {
            long count = ((Number) row[2]).longValue();
            BigDecimal revenue = toMoney(row[1]);
            byCategory.add(new RevenueReportResponse.RevenueGroup(((Enum<?>) row[0]).name(), revenue, count,
                count == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)));
        }

        List<RevenueReportResponse.RevenueGroup> byBranch = new ArrayList<>();
        for (Object[] row : paymentRepository.sumByBranch(fromTs, toTs)) {
            long count = ((Number) row[2]).longValue();
            BigDecimal revenue = toMoney(row[1]);
            byBranch.add(new RevenueReportResponse.RevenueGroup((String) row[0], revenue, count,
                count == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)));
        }

        if (category != null && !category.isBlank()) {
            byCategory.removeIf(group -> !group.key().equalsIgnoreCase(category.trim()));
        }
        if (branch != null && !branch.isBlank()) {
            byBranch.removeIf(group -> !group.key().equalsIgnoreCase(branch.trim()));
        }

        List<RevenueReportResponse.RevenuePoint> byMonth = new ArrayList<>();
        for (Object[] row : paymentRepository.monthlyRevenue(fromTs, toTs)) {
            String bucket = (String) row[0];
            byMonth.add(new RevenueReportResponse.RevenuePoint(bucket, monthLabel(bucket),
                toMoney(row[1]), ((Number) row[2]).longValue(), sumRefundsForMonth(refundsByDay, bucket)));
        }

        RevenueReportResponse.Totals totals = new RevenueReportResponse.Totals(
            gross, refunds, net, paidBookings, cancelledBookings, pendingBookings,
            failedPayments, avgBookingValue, BigDecimal.ZERO);

        return new RevenueReportResponse(start, end, grouping, "INR", totals, series, byCategory, byBranch, byMonth);
    }

    private BigDecimal sumRefundsForMonth(Map<String, BigDecimal> refundsByDay, String month) {
        return refundsByDay.entrySet().stream()
            .filter(entry -> entry.getKey().startsWith(month))
            .map(Map.Entry::getValue)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String normaliseGroupBy(String groupBy) {
        if (groupBy == null || groupBy.isBlank()) {
            return "day";
        }
        String value = groupBy.trim().toLowerCase();
        return switch (value) {
            case "day", "week", "month", "category", "branch" -> value;
            default -> throw InvalidRequestException.unprocessable("INVALID_GROUP_BY",
                "groupBy must be one of: day, week, month, category, branch.");
        };
    }

    /** Refunds keyed by vehicle category, for the categorical revenue series. */
    private Map<String, BigDecimal> refundsByCategory(LocalDateTime from, LocalDateTime to) {
        Map<String, BigDecimal> byGroup = new HashMap<>();
        for (Object[] row : refundRepository.sumRefundedByCategory(from, to)) {
            byGroup.put(String.valueOf(row[0]), toMoney(row[1]));
        }
        return byGroup;
    }

    /** Refunds keyed by pickup branch, for the categorical revenue series. */
    private Map<String, BigDecimal> refundsByBranch(LocalDateTime from, LocalDateTime to) {
        Map<String, BigDecimal> byGroup = new HashMap<>();
        for (Object[] row : refundRepository.sumRefundedByBranch(from, to)) {
            byGroup.put((String) row[0], toMoney(row[1]));
        }
        return byGroup;
    }

    /** Refunds falling inside the seven-day window that starts on the given Monday. */
    private BigDecimal sumRefundsForWeek(Map<String, BigDecimal> refundsByDay, String weekStart) {
        LocalDate monday = LocalDate.parse(weekStart);
        LocalDate sunday = monday.plusDays(6);
        return refundsByDay.entrySet().stream()
            .filter(entry -> {
                LocalDate date = LocalDate.parse(entry.getKey());
                return !date.isBefore(monday) && !date.isAfter(sunday);
            })
            .map(Map.Entry::getValue)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String weekLabel(String bucket) {
        LocalDate monday = LocalDate.parse(bucket);
        LocalDate sunday = monday.plusDays(6);
        return "Week of " + monday.getDayOfMonth() + " " + monthLabel(bucket.substring(0, 7)).substring(0, 3)
            + " - " + sunday.getDayOfMonth() + " " + monthLabel(sunday.toString().substring(0, 7)).substring(0, 3);
    }

    /** Renders enum-style or lower-case keys as a human label ("ECONOMY" -> "Economy"). */
    private String humanise(String value) {
        if (value == null || value.isBlank()) {
            return "Unspecified";
        }
        String[] words = value.trim().split("[_\\s]+");
        StringBuilder label = new StringBuilder();
        for (String word : words) {
            if (label.length() > 0) {
                label.append(' ');
            }
            label.append(Character.toUpperCase(word.charAt(0)));
            if (word.length() > 1) {
                label.append(word.substring(1).toLowerCase());
            }
        }
        return label.toString();
    }

    private String monthLabel(String bucket) {
        String[] parts = bucket.split("-");
        String[] names = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        int month = Integer.parseInt(parts[1]);
        return names[month - 1] + " " + parts[0];
    }

    /**
     * Utilisation = rented days / available rental days for the period.
     * Days are clamped to the reporting window, so a rental spanning the
     * boundary is only counted inside the window.
     */
    @Transactional(readOnly = true)
    public UtilisationReportResponse utilisation(LocalDate from, LocalDate to, UserPrincipal principal) {
        LocalDate start = from == null ? LocalDate.now().withDayOfMonth(1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        if (end.isBefore(start)) {
            throw InvalidRequestException.unprocessable("INVALID_DATE_RANGE",
                "The end date must be on or after the start date.");
        }
        int periodDays = (int) ChronoUnit.DAYS.between(start, end) + 1;

        List<Vehicle> vehicles = vehicleRepository.findAll();
        Map<Long, long[]> rentedDays = new HashMap<>();
        Map<Long, Long> bookingCounts = new HashMap<>();
        Map<Long, BigDecimal> revenue = new HashMap<>();

        for (Booking booking : bookingRepository.findForUtilisation(start, end)) {
            if (booking.getStatus() == BookingStatus.PENDING) {
                continue;   // unpaid holds are not utilisation
            }
            LocalDate windowStart = booking.getPickupDate().isBefore(start) ? start : booking.getPickupDate();
            LocalDate windowEnd = booking.getReturnDate().isAfter(end) ? end : booking.getReturnDate();
            long days = Math.max(0, ChronoUnit.DAYS.between(windowStart, windowEnd));
            if (days == 0 && !windowStart.equals(windowEnd)) {
                continue;
            }
            long[] bucket = rentedDays.computeIfAbsent(booking.getVehicle().getId(), key -> new long[1]);
            bucket[0] += days;
            bookingCounts.merge(booking.getVehicle().getId(), 1L, Long::sum);
            // Revenue is recognised once the rental is under way (ACTIVE) or closed (COMPLETED).
            if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED) {
                revenue.merge(booking.getVehicle().getId(), booking.getBaseAmount(), BigDecimal::add);
            }
        }

        List<UtilisationReportResponse.VehicleUtilisation> rows = new ArrayList<>();
        long fleetRented = 0;
        long fleetAvailable = 0;
        for (Vehicle vehicle : vehicles) {
            if (vehicle.getStatus() == VehicleStatus.RETIRED) {
                continue;
            }
            long rented = rentedDays.getOrDefault(vehicle.getId(), new long[1])[0];
            long available = Math.max(0, periodDays - rented);
            fleetRented += rented;
            fleetAvailable += periodDays;
            BigDecimal percent = periodDays == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(rented * 100.0 / periodDays).setScale(1, RoundingMode.HALF_UP);
            rows.add(new UtilisationReportResponse.VehicleUtilisation(
                vehicle.getId(), vehicle.displayName(), vehicle.getLicensePlate(),
                vehicle.getCategory().name(), vehicle.getLocation(), rented, available,
                bookingCounts.getOrDefault(vehicle.getId(), 0L), percent,
                revenue.getOrDefault(vehicle.getId(), BigDecimal.ZERO), vehicle.getStatus().name()));
        }
        rows.sort(Comparator.comparing(UtilisationReportResponse.VehicleUtilisation::utilisationPercent).reversed());

        BigDecimal fleetPercent = fleetAvailable == 0 ? BigDecimal.ZERO
            : BigDecimal.valueOf(fleetRented * 100.0 / fleetAvailable).setScale(1, RoundingMode.HALF_UP);

        return new UtilisationReportResponse(start, end, periodDays, fleetPercent, fleetRented, fleetAvailable, rows);
    }

    /**
     * Utilisation scoped to a single fleet owner's vehicles.
     *
     * <p>Returns a well-formed empty response when the owner has no vehicles,
     * so the fleet dashboard never has to null-check.</p>
     */
    @Transactional(readOnly = true)
    public UtilisationReportResponse utilisationForOwner(Long ownerId) {
        LocalDate from = LocalDate.now().minusDays(29);
        LocalDate to = LocalDate.now();

        // Which vehicles does this owner actually have?
        Set<Long> ownedVehicleIds = new HashSet<>();
        for (Vehicle vehicle : vehicleRepository.findByOwnerId(
            ownerId, org.springframework.data.domain.Pageable.unpaged()).getContent()) {
            ownedVehicleIds.add(vehicle.getId());
        }

        if (ownedVehicleIds.isEmpty()) {
            return new UtilisationReportResponse(
                from, to, 30, BigDecimal.ZERO, 0L, 0L, List.of());
        }

        UtilisationReportResponse full = utilisation(from, to, null);
        List<UtilisationReportResponse.VehicleUtilisation> filtered = full.vehicles().stream()
            .filter(v -> ownedVehicleIds.contains(v.vehicleId()))
            .toList();

        long rented = filtered.stream()
            .mapToLong(UtilisationReportResponse.VehicleUtilisation::rentedDays).sum();
        long available = filtered.stream()
            .mapToLong(UtilisationReportResponse.VehicleUtilisation::availableDays).sum();

        BigDecimal percent = available == 0 ? BigDecimal.ZERO
            : BigDecimal.valueOf(rented * 100.0 / available).setScale(1, RoundingMode.HALF_UP);

        return new UtilisationReportResponse(
            from, to, full.periodDays(), percent, rented, available, filtered);
    }

    @Transactional(readOnly = true)
    public String exportUtilisationCsv(LocalDate from, LocalDate to) {
        UtilisationReportResponse report = utilisation(from, to, null);
        List<List<?>> rows = new ArrayList<>();
        report.vehicles().forEach(row -> rows.add(List.of(
            row.licensePlate(), row.vehicleName(), row.category(), row.location(), row.status(),
            row.rentedDays(), row.availableDays(), row.utilisationPercent(), row.bookingCount(), row.revenue())));
        return com.driveease.util.CsvWriter.write(List.of("License Plate", "Vehicle", "Category", "Location",
            "Status", "Rented Days", "Available Days", "Utilisation %", "Bookings", "Revenue"), rows);
    }

    @Transactional(readOnly = true)
    public String exportRevenueCsv(LocalDate from, LocalDate to, String groupBy, String category, String branch) {
        RevenueReportResponse report = revenue(from, to, groupBy, category, branch);
        List<List<?>> rows = new ArrayList<>();
        report.series().forEach(point -> rows.add(List.of(
            point.key(), point.label(), point.revenue(), point.bookings(), point.refunds())));
        return com.driveease.util.CsvWriter.write(List.of("Bucket", "Label", "Revenue", "Bookings", "Refunds"), rows);
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal toMoney(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(((Number) value).doubleValue()).setScale(2, RoundingMode.HALF_UP);
    }
}

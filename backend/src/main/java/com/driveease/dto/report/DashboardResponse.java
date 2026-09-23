package com.driveease.dto.report;

import com.driveease.dto.booking.BookingResponse;
import com.driveease.dto.payment.PaymentResponse;
import com.driveease.dto.payment.RefundResponse;
import com.driveease.dto.review.ReviewResponse;
import com.driveease.dto.vehicle.DamageResponse;
import com.driveease.dto.vehicle.MaintenanceResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Aggregated payloads for the three role dashboards. Every number is queried, never hard-coded. */
public final class DashboardResponse {

    private DashboardResponse() {
    }

    public record CustomerDashboard(
            BookingResponse currentBooking,
            List<BookingResponse> upcomingBookings,
            long totalBookings,
            long completedBookings,
            long activeBookings,
            long cancelledBookings,
            BigDecimal lifetimeSpend,
            long unreadNotifications,
            List<PaymentResponse> recentPayments,
            List<BookingResponse> reviewableBookings
    ) {
    }

    public record FleetDashboard(
            Map<String, Long> vehicleStatusCounts,
            long totalVehicles,
            long activeBookings,
            long pendingConfirmations,
            long upcomingPickups,
            long openDamageRecords,
            long scheduledMaintenance,
            BigDecimal fleetValue,
            Double averageDailyRate,
            BigDecimal utilisationPercent,
            List<VehicleStatusRow> vehicles,
            List<BookingResponse> upcomingBookings,
            List<MaintenanceResponse> maintenanceDue,
            List<DamageResponse> recentDamage
    ) {
        public record VehicleStatusRow(
                Long id,
                String displayName,
                String licensePlate,
                String category,
                String status,
                String location,
                Integer mileage,
                BigDecimal dailyRate,
                LocalDate nextBookingDate,
                String nextBookingReference,
                long completedBookings
        ) {
        }
    }

    public record AdminDashboard(
            long totalUsers,
            long activeUsers,
            long customers,
            long fleetManagers,
            long admins,
            Map<String, Long> vehicleStatusCounts,
            long totalVehicles,
            Map<String, Long> bookingStatusCounts,
            long totalBookings,
            BigDecimal grossRevenue,
            BigDecimal netRevenue,
            BigDecimal refundedAmount,
            BigDecimal revenueLast30Days,
            BigDecimal revenuePrevious30Days,
            BigDecimal averageBookingValue,
            long failedPayments,
            long pendingRefunds,
            long totalReviews,
            Double averageRating,
            BigDecimal fleetUtilisationPercent,
            List<BookingResponse> recentBookings,
            List<RefundResponse> recentRefunds,
            List<ReviewResponse> recentReviews,
            List<RevenueReportResponse.RevenuePoint> revenueTrend
    ) {
    }
}

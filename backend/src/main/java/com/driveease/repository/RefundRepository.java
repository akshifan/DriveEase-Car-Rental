package com.driveease.repository;

import com.driveease.entity.Refund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface RefundRepository extends JpaRepository<Refund, Long> {

    List<Refund> findByPaymentIdOrderByCreatedAtDesc(Long paymentId);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM Refund r WHERE r.payment.id = :paymentId AND r.status = 'SUCCESS'")
    BigDecimal sumRefundedForPayment(@Param("paymentId") Long paymentId);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM Refund r WHERE r.payment.booking.id = :bookingId AND r.status = 'SUCCESS'")
    BigDecimal sumRefundedForBooking(@Param("bookingId") Long bookingId);

    boolean existsByBookingIdAndSource(Long bookingId, com.driveease.entity.RefundSource source);

    @EntityGraph(attributePaths = {"booking", "booking.vehicle", "payment"})
    Page<Refund> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM Refund r WHERE r.status = 'SUCCESS' AND r.createdAt >= :from AND r.createdAt < :to")
    BigDecimal sumRefundedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    long countBySourceAndStatus(com.driveease.entity.RefundSource source, com.driveease.entity.RefundStatus status);

    /** Refunds attributed to a vehicle category - used by the revenue report's category grouping. */
    @Query(value = """
            SELECT v.category AS bucket, SUM(r.amount) AS refunded
            FROM refunds r
            JOIN payments p ON p.id = r.payment_id
            JOIN bookings b ON b.id = r.booking_id
            JOIN vehicles v ON v.id = b.vehicle_id
            WHERE r.status = 'SUCCESS' AND r.created_at >= :from AND r.created_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> sumRefundedByCategory(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Refunds attributed to the pickup branch - used by the revenue report's branch grouping. */
    @Query(value = """
            SELECT b.pickup_location AS bucket, SUM(r.amount) AS refunded
            FROM refunds r
            JOIN payments p ON p.id = r.payment_id
            JOIN bookings b ON b.id = r.booking_id
            WHERE r.status = 'SUCCESS' AND r.created_at >= :from AND r.created_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> sumRefundedByBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}

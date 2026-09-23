package com.driveease.repository;

import com.driveease.entity.Payment;
import com.driveease.entity.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    @EntityGraph(attributePaths = {"booking", "booking.vehicle"})
    Page<Payment> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"booking", "booking.vehicle", "user"})
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    Optional<Payment> findDetailById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"booking", "user"})
    @Query("SELECT p FROM Payment p WHERE p.booking.id = :bookingId ORDER BY p.createdAt DESC")
    List<Payment> findByBookingId(@Param("bookingId") Long bookingId);

    List<Payment> findByBookingIdAndStatus(Long bookingId, PaymentStatus status);

    Optional<Payment> findByTransactionRef(String transactionRef);

    boolean existsByTransactionRef(String transactionRef);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status IN ('SUCCESS', 'REFUNDED') AND p.paidAt >= :from AND p.paidAt < :to")
    BigDecimal sumCollected(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    long countByStatus(PaymentStatus status);

    @Query("""
            SELECT p.booking.vehicle.category, COALESCE(SUM(p.amount), 0), COUNT(p)
            FROM Payment p
            WHERE p.status IN ('SUCCESS', 'REFUNDED') AND p.paidAt >= :from AND p.paidAt < :to
            GROUP BY p.booking.vehicle.category
            ORDER BY p.booking.vehicle.category
            """)
    List<Object[]> sumByCategory(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            SELECT p.booking.pickupLocation, COALESCE(SUM(p.amount), 0), COUNT(p)
            FROM Payment p
            WHERE p.status IN ('SUCCESS', 'REFUNDED') AND p.paidAt >= :from AND p.paidAt < :to
            GROUP BY p.booking.pickupLocation
            ORDER BY p.booking.pickupLocation
            """)
    List<Object[]> sumByBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.status = 'FAILED' AND p.createdAt >= :from AND p.createdAt < :to")
    long countFailedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Daily revenue series for reporting - aggregated by PostgreSQL. */
    @Query(value = """
            SELECT to_char(paid_at, 'YYYY-MM-DD') AS bucket, SUM(amount) AS revenue, COUNT(*) AS payments
            FROM payments
            WHERE status IN ('SUCCESS', 'REFUNDED') AND paid_at >= :from AND paid_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> dailyRevenue(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query(value = """
            SELECT to_char(paid_at, 'YYYY-MM') AS bucket, SUM(amount) AS revenue, COUNT(*) AS payments
            FROM payments
            WHERE status IN ('SUCCESS', 'REFUNDED') AND paid_at >= :from AND paid_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> monthlyRevenue(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Weekly revenue series - bucketed by the ISO week start (Monday) computed in PostgreSQL. */
    @Query(value = """
            SELECT to_char(date_trunc('week', paid_at), 'YYYY-MM-DD') AS bucket,
                   SUM(amount) AS revenue, COUNT(*) AS payments
            FROM payments
            WHERE status IN ('SUCCESS', 'REFUNDED') AND paid_at >= :from AND paid_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> weeklyRevenue(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query(value = """
            SELECT to_char(created_at, 'YYYY-MM-DD') AS bucket, SUM(amount) AS refunded
            FROM refunds
            WHERE status = 'SUCCESS' AND created_at >= :from AND created_at < :to
            GROUP BY bucket ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> dailyRefunds(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}

package com.driveease.repository;

import com.driveease.entity.Booking;
import com.driveease.entity.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    @Query("""
            SELECT COUNT(b) FROM Booking b
            WHERE b.vehicle.id = :vehicleId
              AND b.status IN (com.driveease.entity.BookingStatus.PENDING,
                               com.driveease.entity.BookingStatus.CONFIRMED,
                               com.driveease.entity.BookingStatus.ACTIVE)
              AND b.pickupDate < :returnDate
              AND :pickupDate < b.returnDate
              AND (:excludedBookingId IS NULL OR b.id <> :excludedBookingId)
            """)
    long countOverlapping(@Param("vehicleId") Long vehicleId,
                          @Param("pickupDate") LocalDate pickupDate,
                          @Param("returnDate") LocalDate returnDate,
                          @Param("excludedBookingId") Long excludedBookingId);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    Page<Booking> findByUserIdOrderByPickupDateDesc(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findDetailById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    @Query("SELECT b FROM Booking b WHERE b.bookingReference = :reference")
    Optional<Booking> findByReferenceWithDetails(@Param("reference") String reference);

    @Query("""
            SELECT b FROM Booking b JOIN FETCH b.vehicle
            WHERE b.vehicle.id = :vehicleId
            ORDER BY b.pickupDate DESC
            """)
    List<Booking> findByVehicleIdWithVehicle(@Param("vehicleId") Long vehicleId);

    // ── Fleet-scoped finders ────────────────────────────────────────────
    @EntityGraph(attributePaths = {"vehicle", "user"})
    @Query("SELECT b FROM Booking b WHERE b.id = :id AND b.ownerFleet.id = :ownerId")
    Optional<Booking> findByIdAndOwnerFleet(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    Page<Booking> findByOwnerFleetId(Long ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    Page<Booking> findByOwnerFleetIdAndStatus(Long ownerId, BookingStatus status, Pageable pageable);

    long countByOwnerFleetId(Long ownerId);

    long countByOwnerFleetIdAndStatus(Long ownerId, BookingStatus status);

    // ── Fleet earnings aggregates ──────────────────────────────────────
    @Query("""
            SELECT COALESCE(SUM(b.baseAmount), 0) FROM Booking b
            WHERE b.ownerFleet.id = :ownerId
              AND b.status = com.driveease.entity.BookingStatus.COMPLETED
            """)
    BigDecimal sumCompletedRentalRevenueForOwner(@Param("ownerId") Long ownerId);

    @Query("""
            SELECT COALESCE(SUM(b.baseAmount), 0) FROM Booking b
            WHERE b.ownerFleet.id = :ownerId
              AND b.status = com.driveease.entity.BookingStatus.ACTIVE
            """)
    BigDecimal sumActiveRentalRevenueForOwner(@Param("ownerId") Long ownerId);

    @Query("""
            SELECT COUNT(b) FROM Booking b
            WHERE b.ownerFleet.id = :ownerId
              AND b.status = com.driveease.entity.BookingStatus.COMPLETED
            """)
    long countCompletedForOwner(@Param("ownerId") Long ownerId);

    @EntityGraph(attributePaths = {"vehicle", "user"})
    @Query("""
            SELECT b FROM Booking b
            WHERE b.ownerFleet.id = :ownerId
              AND b.status = com.driveease.entity.BookingStatus.CONFIRMED
              AND b.pickupDate >= :today
            ORDER BY b.pickupDate ASC
            """)
    List<Booking> findConfirmedUpcomingForOwner(@Param("ownerId") Long ownerId,
                                                @Param("today") LocalDate today,
                                                Pageable pageable);

    // ── Existing aggregate helpers (kept, still used by admin) ──────────
    @EntityGraph(attributePaths = {"vehicle", "ownerFleet"})
    @Query("""
            SELECT b FROM Booking b
            WHERE b.status IN (com.driveease.entity.BookingStatus.CONFIRMED, com.driveease.entity.BookingStatus.ACTIVE)
              AND b.returnDate >= :today
            """)
    List<Booking> findLiveBookings(@Param("today") LocalDate today);

    @Query("""
            SELECT b FROM Booking b
            WHERE b.vehicle.id = :vehicleId
              AND b.status IN (com.driveease.entity.BookingStatus.PENDING,
                               com.driveease.entity.BookingStatus.CONFIRMED,
                               com.driveease.entity.BookingStatus.ACTIVE)
              AND b.returnDate >= :today
            ORDER BY b.pickupDate ASC
            """)
    Page<Booking> findBlockingBookings(@Param("vehicleId") Long vehicleId,
                                       @Param("today") LocalDate today, Pageable pageable);

    @Query("""
            SELECT b.vehicle.id, COUNT(b) FROM Booking b
            WHERE b.status = com.driveease.entity.BookingStatus.COMPLETED
            GROUP BY b.vehicle.id
            """)
    List<Object[]> completedCountsByVehicle();

    long countByStatus(BookingStatus status);

    long countByUserIdAndStatus(Long userId, BookingStatus status);

    @Query("""
            SELECT b FROM Booking b JOIN FETCH b.vehicle v JOIN FETCH b.user u
            WHERE b.status <> com.driveease.entity.BookingStatus.CANCELLED
              AND b.returnDate >= :from AND b.pickupDate <= :to
            """)
    List<Booking> findForUtilisation(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            SELECT COALESCE(SUM(b.totalAmount), 0) FROM Booking b
            WHERE b.status IN (com.driveease.entity.BookingStatus.CONFIRMED,
                               com.driveease.entity.BookingStatus.ACTIVE,
                               com.driveease.entity.BookingStatus.COMPLETED)
              AND b.createdAt >= :from AND b.createdAt < :to
            """)
    BigDecimal sumConfirmedAmount(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            SELECT b FROM Booking b JOIN FETCH b.vehicle
            WHERE b.status IN (com.driveease.entity.BookingStatus.CONFIRMED,
                               com.driveease.entity.BookingStatus.ACTIVE)
              AND b.pickupDate >= :today
            ORDER BY b.pickupDate ASC
            """)
    List<Booking> findUpcomingWithVehicle(@Param("today") LocalDate today, Pageable pageable);

    @Query("""
            SELECT b.vehicle.id, COUNT(b) FROM Booking b
            WHERE b.pickupDate <= :to AND b.returnDate >= :from
            GROUP BY b.vehicle.id
            """)
    List<Object[]> countBookingsPerVehicle(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // ── Admin fleet aggregate: bookings grouped by owning fleet ────────
    @Query("""
            SELECT b.ownerFleet.id, COUNT(b), COALESCE(SUM(b.baseAmount), 0)
            FROM Booking b
            WHERE b.status = com.driveease.entity.BookingStatus.COMPLETED
            GROUP BY b.ownerFleet.id
            """)
    List<Object[]> completedAggregatesByOwner();
}

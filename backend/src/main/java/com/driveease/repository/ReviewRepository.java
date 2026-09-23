package com.driveease.repository;

import com.driveease.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long>, JpaSpecificationExecutor<Review> {

    Optional<Review> findByBookingId(Long bookingId);

    boolean existsByBookingId(Long bookingId);

    @EntityGraph(attributePaths = {"user", "vehicle"})
    Page<Review> findByVehicleIdAndDeletedFalseOrderByCreatedAtDesc(Long vehicleId, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "vehicle", "booking"})
    Page<Review> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Average rating per vehicle for a whole page in one grouped query - no N+1 on list views. */
    @Query("SELECT r.vehicle.id, AVG(r.rating) FROM Review r WHERE r.vehicle.id IN :vehicleIds AND r.deleted = false GROUP BY r.vehicle.id")
    List<Object[]> averageRatingsByVehicleIds(@Param("vehicleIds") java.util.Collection<Long> vehicleIds);

    /** Review count per vehicle for a whole page in one grouped query - no N+1 on list views. */
    @Query("SELECT r.vehicle.id, COUNT(r) FROM Review r WHERE r.vehicle.id IN :vehicleIds AND r.deleted = false GROUP BY r.vehicle.id")
    List<Object[]> countsByVehicleIds(@Param("vehicleIds") java.util.Collection<Long> vehicleIds);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.vehicle.id = :vehicleId AND r.deleted = false")
    Double averageRating(@Param("vehicleId") Long vehicleId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.vehicle.id = :vehicleId AND r.deleted = false")
    long countByVehicle(@Param("vehicleId") Long vehicleId);

    @Query("""
            SELECT r.rating, COUNT(r) FROM Review r
            WHERE r.vehicle.id = :vehicleId AND r.deleted = false
            GROUP BY r.rating ORDER BY r.rating DESC
            """)
    java.util.List<Object[]> ratingBreakdown(@Param("vehicleId") Long vehicleId);

    long countByDeletedFalse();

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.deleted = false")
    Double overallAverageRating();
}

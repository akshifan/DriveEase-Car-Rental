package com.driveease.repository;

import com.driveease.entity.Vehicle;
import com.driveease.entity.VehicleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VehicleRepository extends JpaRepository<Vehicle, Long>, JpaSpecificationExecutor<Vehicle> {

    boolean existsByLicensePlateIgnoreCase(String licensePlate);

    Optional<Vehicle> findByLicensePlateIgnoreCase(String licensePlate);

    @Query("SELECT v FROM Vehicle v WHERE v.id = :id")
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Vehicle> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = "images")
    @Query("SELECT v FROM Vehicle v WHERE v.id = :id")
    Optional<Vehicle> findDetailById(@Param("id") Long id);

    // ── Fleet-scoped finders ────────────────────────────────────────────
    @EntityGraph(attributePaths = "images")
    @Query("SELECT v FROM Vehicle v WHERE v.id = :id AND v.owner.id = :ownerId")
    Optional<Vehicle> findByIdAndOwner(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @Query("SELECT v FROM Vehicle v WHERE v.id = :id AND v.owner.id = :ownerId")
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Vehicle> findByIdAndOwnerForUpdate(@Param("id") Long id, @Param("ownerId") Long ownerId);

    Page<Vehicle> findByOwnerId(Long ownerId, Pageable pageable);

    Page<Vehicle> findByOwnerIdAndStatus(Long ownerId, VehicleStatus status, Pageable pageable);

    long countByOwnerId(Long ownerId);

    long countByOwnerIdAndStatus(Long ownerId, VehicleStatus status);

    // ── Existing aggregate helpers unchanged ─────────────────────────────
    long countByStatus(VehicleStatus status);

    @Query("SELECT v.location, COUNT(v) FROM Vehicle v WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED AND v.location IS NOT NULL GROUP BY v.location ORDER BY v.location")
    List<Object[]> countGroupedByLocation();

    @Query("SELECT DISTINCT v.location FROM Vehicle v WHERE v.location IS NOT NULL AND v.status <> com.driveease.entity.VehicleStatus.RETIRED ORDER BY v.location")
    List<String> findActiveLocations();

    @Query("SELECT COALESCE(AVG(v.dailyRate), 0) FROM Vehicle v WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED")
    Double averageDailyRate();

    @Query("""
            SELECT v.category, MIN(v.dailyRate), COUNT(v)
            FROM Vehicle v
            WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED
            GROUP BY v.category
            ORDER BY v.category
            """)
    List<Object[]> categorySummary();
}

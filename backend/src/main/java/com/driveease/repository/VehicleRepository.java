package com.driveease.repository;

import com.driveease.entity.Vehicle;
import com.driveease.entity.VehicleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /** Pessimistic write lock used by the booking engine to serialise concurrent requests. */
    @Query("SELECT v FROM Vehicle v WHERE v.id = :id")
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Vehicle> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = "images")
    @Query("SELECT v FROM Vehicle v WHERE v.id = :id")
    Optional<Vehicle> findDetailById(@Param("id") Long id);

    long countByStatus(VehicleStatus status);

    @Query("SELECT v.location, COUNT(v) FROM Vehicle v WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED AND v.location IS NOT NULL GROUP BY v.location ORDER BY v.location")
    List<Object[]> countGroupedByLocation();

    @Query("SELECT DISTINCT v.location FROM Vehicle v WHERE v.location IS NOT NULL AND v.status <> com.driveease.entity.VehicleStatus.RETIRED ORDER BY v.location")
    List<String> findActiveLocations();

    @Query("SELECT COALESCE(AVG(v.dailyRate), 0) FROM Vehicle v WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED")
    Double averageDailyRate();

    /** Category rollup for the catalogue filter UI: vehicle count + cheapest daily rate. */
    @Query("""
            SELECT v.category, MIN(v.dailyRate), COUNT(v)
            FROM Vehicle v
            WHERE v.status <> com.driveease.entity.VehicleStatus.RETIRED
            GROUP BY v.category
            ORDER BY v.category
            """)
    List<Object[]> categorySummary();
}

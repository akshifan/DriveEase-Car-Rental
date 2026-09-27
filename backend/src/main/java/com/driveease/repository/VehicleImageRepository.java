package com.driveease.repository;

import com.driveease.entity.VehicleImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface VehicleImageRepository extends JpaRepository<VehicleImage, Long> {

    List<VehicleImage> findByVehicleIdOrderByDisplayOrderAsc(Long vehicleId);

    List<VehicleImage> findByVehicleIdInAndPrimaryTrue(List<Long> vehicleIds);

    /**
     * Bulk delete of a vehicle's gallery.
     *
     * <p>This MUST be a {@code @Modifying} JPQL delete. The derived-query form
     * ({@code void deleteByVehicleId(Long)}) makes Hibernate load each entity
     * and schedule the DELETE actions at the end of the flush cycle, which
     * means inserts added by {@code replaceGallery()} run first — and those
     * inserts collide with the still-present primary row, triggering
     * {@code uq_vehicle_images_primary}.</p>
     *
     * <p>{@code flushAutomatically = true} forces the DELETE to hit the
     * database immediately. {@code clearAutomatically = true} clears the
     * persistence context so the next {@code save()} doesn't try to
     * reconcile stale entity state.</p>
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Transactional
    @Query("DELETE FROM VehicleImage vi WHERE vi.vehicle.id = :vehicleId")
    void deleteByVehicleId(@Param("vehicleId") Long vehicleId);
}

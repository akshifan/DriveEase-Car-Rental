package com.driveease.repository;

import com.driveease.entity.VehicleImage;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;

public interface VehicleImageRepository extends JpaRepository<VehicleImage, Long> {

    List<VehicleImage> findByVehicleIdOrderByDisplayOrderAsc(Long vehicleId);

    /** Primary shot for a page of vehicles in one query - no N+1 in list views. */
    List<VehicleImage> findByVehicleIdInAndPrimaryTrue(List<Long> vehicleIds);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Transactional
    void deleteByVehicleId(Long vehicleId);
}

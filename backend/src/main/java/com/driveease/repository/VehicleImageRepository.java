package com.driveease.repository;

import com.driveease.entity.VehicleImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehicleImageRepository extends JpaRepository<VehicleImage, Long> {

    List<VehicleImage> findByVehicleIdOrderByDisplayOrderAsc(Long vehicleId);

    /** Primary shot for a page of vehicles in one query - no N+1 in list views. */
    List<VehicleImage> findByVehicleIdInAndPrimaryTrue(List<Long> vehicleIds);

    void deleteByVehicleId(Long vehicleId);
}

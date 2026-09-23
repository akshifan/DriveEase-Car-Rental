package com.driveease.repository;

import com.driveease.entity.MaintenanceRecord;
import com.driveease.entity.MaintenanceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MaintenanceRecordRepository extends JpaRepository<MaintenanceRecord, Long> {

    @EntityGraph(attributePaths = "vehicle")
    Page<MaintenanceRecord> findAllByOrderByScheduledDateDesc(Pageable pageable);

    List<MaintenanceRecord> findByVehicleIdOrderByScheduledDateDesc(Long vehicleId);

    long countByStatus(MaintenanceStatus status);

    boolean existsByVehicleIdAndStatusIn(Long vehicleId, List<MaintenanceStatus> statuses);
}

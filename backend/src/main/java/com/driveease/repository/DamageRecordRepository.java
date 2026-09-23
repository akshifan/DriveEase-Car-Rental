package com.driveease.repository;

import com.driveease.entity.DamageRecord;
import com.driveease.entity.DamageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DamageRecordRepository extends JpaRepository<DamageRecord, Long> {

    @EntityGraph(attributePaths = {"vehicle", "booking"})
    Page<DamageRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<DamageRecord> findByVehicleIdOrderByCreatedAtDesc(Long vehicleId);

    long countByStatus(DamageStatus status);

    long countByVehicleIdAndStatusNot(Long vehicleId, DamageStatus status);
}

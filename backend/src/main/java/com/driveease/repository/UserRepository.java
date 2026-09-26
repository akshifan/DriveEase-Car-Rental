package com.driveease.repository;

import com.driveease.entity.Role;
import com.driveease.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByVerificationToken(String verificationToken);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByLicenseNoIgnoreCase(String licenseNo);

    boolean existsByLicenseNoIgnoreCaseAndIdNot(String licenseNo, Long id);

    long countByRole(Role role);

    long countByActiveTrue();

    long countByRoleAndActiveTrue(Role role);

    List<User> findTop5ByOrderByCreatedAtDesc();
}

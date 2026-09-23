package com.driveease.service;

import com.driveease.dto.common.PageResponse;
import com.driveease.dto.review.ReviewCreateRequest;
import com.driveease.dto.review.ReviewResponse;
import com.driveease.dto.review.VehicleRatingSummary;
import com.driveease.entity.*;
import com.driveease.exception.DuplicateResourceException;
import com.driveease.exception.InsufficientPermissionException;
import com.driveease.exception.InvalidRequestException;
import com.driveease.exception.ResourceNotFoundException;
import com.driveease.mapper.ReviewMapper;
import com.driveease.repository.BookingRepository;
import com.driveease.repository.ReviewRepository;
import com.driveease.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reviews (PRD EPIC-06).
 *
 * <ul>
 *   <li>one review per booking, only for the customer's own COMPLETED rental;</li>
 *   <li>rating 1-5, comment optional up to 1000 characters;</li>
 *   <li>public listings expose a first name and initials only - no email, phone or address;</li>
 *   <li>admins can soft-delete with a reason, and the action is audited.</li>
 * </ul>
 */
@Service
public class ReviewService {

    private static final Logger log = LoggerFactory.getLogger(ReviewService.class);

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final ReviewMapper reviewMapper;
    private final AuditService auditService;

    public ReviewService(ReviewRepository reviewRepository,
                         BookingRepository bookingRepository,
                         ReviewMapper reviewMapper,
                         AuditService auditService) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.reviewMapper = reviewMapper;
        this.auditService = auditService;
    }

    @Transactional
    public ReviewResponse create(Long userId, ReviewCreateRequest request) {
        Booking booking = bookingRepository.findDetailById(request.bookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.bookingId()));

        if (!booking.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking " + request.bookingId() + " was not found.");
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw InvalidRequestException.unprocessable("BOOKING_NOT_COMPLETED",
                    "You can review a vehicle only after the rental is completed.");
        }
        if (reviewRepository.existsByBookingId(booking.getId())) {
            throw new DuplicateResourceException("REVIEW_ALREADY_SUBMITTED",
                    "You have already reviewed this rental.");
        }
        if (booking.getVehicle().getStatus() == VehicleStatus.RETIRED) {
            throw InvalidRequestException.unprocessable("VEHICLE_RETIRED",
                    "This vehicle has been retired from the fleet.");
        }

        Review review = new Review();
        review.setUser(booking.getUser());
        review.setVehicle(booking.getVehicle());
        review.setBooking(booking);
        review.setRating(request.rating());
        review.setTitle(request.title() == null || request.title().isBlank() ? null : request.title().trim());
        review.setComment(request.comment() == null || request.comment().isBlank() ? null : request.comment().trim());
        Review saved = reviewRepository.save(review);
        log.info("Review {} submitted for vehicle {} ({} stars)",
                saved.getId(), booking.getVehicle().getId(), saved.getRating());
        return reviewMapper.toOwnerResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> forVehicle(Long vehicleId, Pageable pageable) {
        return PageResponse.of(
                reviewRepository.findByVehicleIdAndDeletedFalseOrderByCreatedAtDesc(vehicleId, pageable),
                reviewMapper::toPublicResponse);
    }

    @Transactional(readOnly = true)
    public VehicleRatingSummary summary(Long vehicleId) {
        Double average = reviewRepository.averageRating(vehicleId);
        long count = reviewRepository.countByVehicle(vehicleId);
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            distribution.put(star, 0L);
        }
        for (Object[] row : reviewRepository.ratingBreakdown(vehicleId)) {
            distribution.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        return new VehicleRatingSummary(vehicleId,
                average == null ? 0d : com.driveease.mapper.VehicleMapper.round(average), count, distribution);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> forBooking(Long bookingId, UserPrincipal principal) {
        return reviewRepository.findByBookingId(bookingId)
                .map(review -> List.of(principal.getRole().isStaff()
                        ? reviewMapper.toOwnerResponse(review) : reviewMapper.toPublicResponse(review)))
                .orElseGet(List::of);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> search(String search, Integer maxRating, Long vehicleId,
                                               boolean includeDeleted, Pageable pageable) {
        var spec = org.springframework.data.jpa.domain.Specification.allOf(
                com.driveease.repository.spec.ReviewSpecifications.includeDeleted(includeDeleted),
                com.driveease.repository.spec.ReviewSpecifications.forVehicle(vehicleId),
                com.driveease.repository.spec.ReviewSpecifications.ratingAtMost(maxRating),
                (root, query, cb) -> {
                    if (search == null || search.isBlank()) {
                        return cb.conjunction();
                    }
                    String like = "%" + search.trim().toLowerCase() + "%";
                    return cb.or(
                            cb.like(cb.lower(root.get("comment")), like),
                            cb.like(cb.lower(root.get("title")), like),
                            cb.like(cb.lower(root.get("vehicle").get("make")), like),
                            cb.like(cb.lower(root.get("vehicle").get("model")), like));
                });
        return PageResponse.of(reviewRepository.findAll(spec, pageable), reviewMapper::toOwnerResponse);
    }

    /** Admin moderation: soft delete with a mandatory reason (PRD US-06-03). */
    @Transactional
    public void moderate(Long reviewId, String reason, UserPrincipal principal) {
        if (principal.getRole() != Role.ADMIN) {
            throw new InsufficientPermissionException("Only an administrator can moderate reviews.");
        }
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", reviewId));
        if (review.isDeleted()) {
            return;
        }
        review.setDeleted(true);
        review.setDeletedAt(LocalDateTime.now());
        review.setDeletedBy(principal.getId());
        review.setDeleteReason(reason);
        reviewRepository.save(review);
        auditService.record(AuditAction.REVIEW_REMOVED, "Review", reviewId,
                "Review removed for vehicle " + review.getVehicle().getLicensePlate(), "reason=" + reason);
        log.info("Review {} moderated by admin {}", reviewId, principal.getId());
    }
}

package com.driveease.mapper;

import com.driveease.dto.booking.BookingVehicleSummary;
import com.driveease.dto.vehicle.VehicleImageResponse;
import com.driveease.dto.vehicle.VehicleResponse;
import com.driveease.entity.Vehicle;
import com.driveease.entity.VehicleImage;
import com.driveease.entity.VehicleStatus;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class VehicleMapper {

    public VehicleResponse toResponse(Vehicle vehicle, Double averageRating, Long reviewCount) {
        return toResponse(vehicle, averageRating, reviewCount, null);
    }

    /**
     * @param galleryFallbackImageUrl used when the vehicle has no explicit cover
     *        image - list views resolve it in batch from the primary gallery shot.
     */
    public VehicleResponse toResponse(Vehicle vehicle, Double averageRating, Long reviewCount,
                                      String galleryFallbackImageUrl) {
        if (vehicle == null) {
            return null;
        }
        return new VehicleResponse(
                vehicle.getId(),
                vehicle.getMake(),
                vehicle.getModel(),
                vehicle.displayName(),
                vehicle.getYear(),
                vehicle.getCategory(),
                vehicle.getLicensePlate(),
                vehicle.getDailyRate(),
                vehicle.getDepositAmount(),
                vehicle.getStatus(),
                vehicle.getLocation(),
                vehicle.getMileage(),
                vehicle.getSeats(),
                vehicle.getDoors(),
                vehicle.getFuelType(),
                vehicle.getTransmission(),
                vehicle.getImageUrl() != null ? vehicle.getImageUrl() : galleryFallbackImageUrl,
                vehicle.getDescription(),
                vehicle.getStatus() == VehicleStatus.AVAILABLE,
                averageRating == null ? 0d : round(averageRating),
                reviewCount == null ? 0L : reviewCount,
                vehicle.getCreatedAt());
    }

    public VehicleImageResponse toResponse(VehicleImage image) {
        return new VehicleImageResponse(image.getId(), image.getUrl(), image.getAltText(),
                image.getDisplayOrder() == null ? 0 : image.getDisplayOrder(), image.isPrimary());
    }

    public BookingVehicleSummary toSummary(Vehicle vehicle) {
        if (vehicle == null) {
            return null;
        }
        return new BookingVehicleSummary(
                vehicle.getId(),
                vehicle.getMake(),
                vehicle.getModel(),
                vehicle.displayName(),
                vehicle.getCategory(),
                vehicle.getImageUrl(),
                vehicle.getLicensePlate(),
                vehicle.getLocation());
    }

    public List<VehicleImageResponse> toImageResponses(List<VehicleImage> images) {
        return images == null ? List.of() : images.stream().map(this::toResponse).toList();
    }

    /** Ratings are displayed with one decimal; the API never exposes raw JPA floats. */
    public static Double round(Double value) {
        return value == null ? null : Math.round(value * 10d) / 10d;
    }
}

package com.driveease.dto.vehicle;

public record VehicleImageResponse(Long id, String url, String altText, int displayOrder, boolean primary) {
}

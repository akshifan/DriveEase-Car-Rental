package com.driveease.controller;

import com.driveease.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/uploads")
@PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
@Tag(name = "Uploads", description = "Vehicle image uploads")
public class UploadController {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Set<String> ALLOWED_EXT   = Set.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;   // 5 MB per file

    private final AppProperties properties;

    public UploadController(AppProperties properties) {
        this.properties = properties;
    }

    @PostMapping(value = "/vehicle-image", consumes = "multipart/form-data")
    @Operation(summary = "Upload a single vehicle image; returns its public URL")
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file supplied.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                "File exceeds 5 MB. Choose a smaller image.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Only JPEG, PNG and WebP are accepted.");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String ext = original.contains(".")
            ? original.substring(original.lastIndexOf('.') + 1).toLowerCase()
            : "";
        if (!ALLOWED_EXT.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Unsupported file extension.");
        }

        String filename = UUID.randomUUID() + "." + ext;
        Path dir = Paths.get(properties.getUploads().getDirectory(), "vehicles")
            .toAbsolutePath().normalize();
        try {
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(filename));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Could not store the file.");
        }
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("url", "/uploads/vehicles/" + filename));
    }
}

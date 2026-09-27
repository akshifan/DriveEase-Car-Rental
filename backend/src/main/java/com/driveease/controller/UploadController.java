package com.driveease.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Vehicle image uploads backed by Supabase Storage.
 *
 * <p>Render's free tier has an ephemeral filesystem - files written to
 * {@code /app/uploads/} vanish on every container restart. Supabase Storage
 * provides durable object storage on a free tier, and public URLs are
 * directly renderable by the browser.</p>
 *
 * <p>Required environment variables:</p>
 * <ul>
 *   <li>{@code SUPABASE_URL} - e.g. {@code https://ziqnpplegdyzqaamihyz.supabase.co}</li>
 *   <li>{@code SUPABASE_SERVICE_KEY} - the service_role key (backend only, never sent to the frontend)</li>
 *   <li>{@code SUPABASE_BUCKET} - optional, defaults to {@code vehicles}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/uploads")
@PreAuthorize("hasAnyRole('FLEET_MANAGER','ADMIN')")
@Tag(name = "Uploads", description = "Vehicle image uploads (Supabase Storage)")
public class UploadController {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Set<String> ALLOWED_EXT   = Set.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;   // 5 MB per file

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${driveease.uploads.supabase-url:}")
    private String supabaseUrl;

    @Value("${driveease.uploads.supabase-service-key:}")
    private String supabaseServiceKey;

    @Value("${driveease.uploads.supabase-bucket:vehicles}")
    private String bucket;

    @PostMapping(value = "/vehicle-image", consumes = "multipart/form-data")
    @Operation(summary = "Upload a single vehicle image to Supabase Storage; returns its public URL")
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        // ---------- validation ----------
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

        // ---------- config guard ----------
        if (supabaseUrl == null || supabaseUrl.isBlank()
            || supabaseServiceKey == null || supabaseServiceKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
        }

        // ---------- upload to Supabase Storage ----------
        String filename = UUID.randomUUID() + "." + ext;
        String uploadUrl = "%s/storage/v1/object/%s/%s".formatted(
            supabaseUrl.replaceAll("/$", ""), bucket, filename);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.set("Authorization", "Bearer " + supabaseServiceKey);
        headers.set("x-upsert", "true");

        try {
            HttpEntity<byte[]> entity = new HttpEntity<>(file.getBytes(), headers);
            ResponseEntity<String> response = restTemplate.exchange(
                uploadUrl, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Supabase Storage rejected the upload: " + response.getStatusCode());
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Could not read the uploaded file.", ex);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Could not reach Supabase Storage: " + ex.getMessage(), ex);
        }

        // ---------- return the public URL ----------
        String publicUrl = "%s/storage/v1/object/public/%s/%s".formatted(
            supabaseUrl.replaceAll("/$", ""), bucket, filename);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", publicUrl));
    }
}

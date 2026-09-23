# API Reference

Base URL: **`/api/v1`** · JSON in/out · Bearer access token on every
authenticated call · Live docs at `/swagger-ui.html` (OpenAPI 3 at
`/v3/api-docs`).

**Conventions**

- Pagination: `?page=0&size=20&sort=field,dir` →
  `{content, page, size, totalElements, totalPages, first, last}`.
- Errors are always
  `{timestamp, status, code, message, path}` (+ `fieldErrors` for validation).
  Domain codes include `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
  `RESOURCE_NOT_FOUND`/`ENDPOINT_NOT_FOUND` (404), business conflicts (409),
  validation/business-rule failures (400/422).
- Dates are `ISO-8601` (`LocalDate`), timestamps ISO with time; money is a
  decimal string/number — never floats in responses.

## Auth — `/auth`

| Method | Path              | Auth | Body / Notes                                                                 |
|--------|-------------------|------|------------------------------------------------------------------------------|
| POST   | `/auth/register`  | –    | `{email, password, firstName, lastName, phone}` → tokens + user; `409 EMAIL_ALREADY_REGISTERED` |
| POST   | `/auth/login`     | –    | `{email, password}` → `{accessToken, tokenType, expiresIn, user}` + sets the `driveease_refresh` HttpOnly cookie; `401` bad credentials, `403 ACCOUNT_DISABLED` |
| POST   | `/auth/refresh`   | cookie | Rotates the refresh token → `{accessToken, tokenType, expiresIn}`; reuse of a rotated token revokes the whole family |
| POST   | `/auth/logout`    | ✓    | Revokes the presented refresh token and clears the cookie                    |
| GET    | `/auth/session`   | ✓    | Current profile (source of truth after refresh)                              |
| POST   | `/auth/forgot-password` | – | `{email}` → always `{message, …}`; dev responses add `resetToken` + `expiresInMinutes` |
| POST   | `/auth/reset-password`  | – | `{token, newPassword}` → `400 INVALID_RESET_TOKEN / RESET_TOKEN_EXPIRED` |
| POST   | `/auth/change-password` | ✓ | `{currentPassword, newPassword}`                                            |

## Users — `/users`

| Method | Path                     | Auth     | Notes                                                          |
|--------|--------------------------|----------|----------------------------------------------------------------|
| GET    | `/users/me`              | any      | Own profile                                                    |
| PATCH  | `/users/me`              | any      | All-optional `{fullName?, phone?, …}`                          |
| GET    | `/users/me/notifications`| any      | Page of notifications                                          |
| GET    | `/users/me/notifications/unread-count` | any | `{unread: n}`                                     |
| POST   | `/users/me/notifications/read` | any | Marks notifications read                                       |
| GET    | `/users`                 | ADMIN    | Filters `role`, `active`, `search` — server-side Specification |
| GET    | `/users/{id}`            | ADMIN    | Single user                                                    |
| PATCH  | `/users/{id}/status`     | ADMIN    | `{active, reason}` → activate/deactivate (audited)             |
| POST   | `/users/staff`           | ADMIN    | `{email, password, firstName, lastName, phone, role}` create staff |

## Vehicles — `/vehicles`

| Method | Path                        | Auth       | Notes                                                          |
|--------|-----------------------------|------------|----------------------------------------------------------------|
| GET    | `/vehicles`                 | public     | Search + filters `pickupDate&returnDate` (availability), `location`, `category`, `fuelType`, `transmission`, `minPrice/maxPrice`, `search`, `sort`, pageable |
| GET    | `/vehicles/locations`       | public     | Distinct branches                                              |
| GET    | `/vehicles/categories`      | public     | Category facets with counts                                    |
| GET    | `/vehicles/{id}`            | public     | Detail: features, gallery, rating distribution, `nextAvailableFrom`, `upcomingAvailability` |
| GET    | `/vehicles/{id}/availability` | ✓        | With dates → availability verdict; without → booked periods    |
| GET    | `/vehicles/{id}/history`    | FM/ADMIN   | `{vehicleId, displayName, licensePlate, events[]}` — bookings/maintenance/damage/status timeline |
| POST   | `/vehicles`                 | ADMIN      | Create fleet vehicle (`409 LICENSE_PLATE_EXISTS`)              |
| PATCH  | `/vehicles/{id}`            | FM/ADMIN   | **All-optional** partial update                                |
| PATCH  | `/vehicles/{id}/status`     | FM/ADMIN   | `{status, reason}` — transition rules enforced; retire rejects `RENTED` |
| DELETE | `/vehicles/{id}`            | ADMIN      | Retire (soft) — not available to new bookings                  |
| POST   | `/vehicles/{id}/damage`     | FM/ADMIN   | `{description, severity, locationOnVehicle, bookingId?, repairEstimate}` — `422` if bookingId belongs to another vehicle |
| GET    | `/vehicles/{id}/damage`     | FM/ADMIN   | Damage log for the vehicle                                     |

## Bookings — `/bookings`

| Method | Path                     | Auth     | Notes                                                          |
|--------|--------------------------|----------|----------------------------------------------------------------|
| POST   | `/bookings/quote`        | ✓        | `{vehicleId, pickupDate, returnDate}` → `{totalDays, dailyRate, baseAmount, depositAmount, totalAmount, currency}` |
| POST   | `/bookings`              | ✓        | `{vehicleId, pickupDate, returnDate, pickupLocation, returnLocation, notes?}` → `201 PENDING`; overlap → `409 VEHICLE_NOT_AVAILABLE` |
| GET    | `/bookings`              | ✓        | Own bookings (`?status=`)                                      |
| GET    | `/bookings/{id}`         | owner/staff | Detail incl. `payments[]`, `history[]`, `cancellable`, `reviewable` |
| GET    | `/bookings/reference/{reference}` | owner/staff | Lookup by `DE-…` reference                  |
| POST   | `/bookings/{id}/cancel`  | owner    | `{reason}` → `CANCELLED` + automatic cancellation refund of paid amounts |
| PATCH  | `/bookings/{id}/status`  | FM/ADMIN | `{status, mileage?, note?}` — `CONFIRMED→ACTIVE` (pickup), `ACTIVE→COMPLETED` (return); illegal jumps → `422 INVALID_BOOKING_STATE` |
| GET    | `/bookings/admin/all`    | FM/ADMIN | Filters `status, startDate, endDate, vehicleId, userId, search` |
| GET    | `/admin/bookings/export` | ADMIN    | CSV (escaped) — booking ref, customer, vehicle, dates, status, amount, location |

## Payments — `/payments`

| Method | Path                       | Auth     | Notes                                                          |
|--------|----------------------------|----------|----------------------------------------------------------------|
| POST   | `/payments`                | ✓ (owner) | `{bookingId, amount, paymentMethod, cardLast4?, upiId?, idempotencyKey?}` → `201` with `status SUCCESS|FAILED` (+ `failureReason`). Amount must equal the booking total (`422 AMOUNT_MISMATCH`). Success flips the booking to `CONFIRMED`. Sandbox declines: amount > failure threshold, card last-4 `0000`, UPI handle containing `fail` |
| GET    | `/payments`                | ✓        | Own payment history                                            |
| GET    | `/payments/{id}`           | owner/staff | Detail incl. `receipt` (`RCPT-<paymentRef>`), `refunds[]`   |
| GET    | `/payments/booking/{bookingId}` | owner/staff | Payments for one booking                              |
| GET    | `/payments/admin/all`      | ADMIN    | Filters `status, reference, from, to`                          |
| GET    | `/payments/admin/refunds`  | ADMIN    | Refund ledger page                                             |
| POST   | `/payments/{id}/refund`    | ADMIN    | `{amount, reason}` — partial or full; > original → 409; duplicate full refund blocked; actor recorded |

## Reviews — `/reviews`

| Method | Path                        | Auth       | Notes                                                          |
|--------|-----------------------------|------------|----------------------------------------------------------------|
| POST   | `/reviews`                  | ✓ (customer) | `{bookingId, rating 1–5, title?, comment ≤1000}` — only own `COMPLETED` booking (`422 BOOKING_NOT_COMPLETED`), one per booking (`409 REVIEW_ALREADY_SUBMITTED`) |
| GET    | `/reviews/vehicle/{id}`     | public     | Page (first name only — no reviewer PII)                       |
| GET    | `/reviews/summary/{id}`     | public     | Average rating + count                                         |
| GET    | `/reviews/booking/{id}`     | owner/staff| Review attached to a booking                                   |
| GET    | `/reviews/admin/all`        | ADMIN      | Filters `search, maxRating, vehicleId, includeDeleted`         |
| DELETE | `/reviews/{id}`             | ADMIN      | JSON body `{reason}` — soft delete, reason logged              |

## Fleet console — `/fleet` (FLEET_MANAGER / ADMIN)

| Method | Path                              | Notes                                                        |
|--------|-----------------------------------|--------------------------------------------------------------|
| GET    | `/fleet/dashboard`                | Fleet KPIs (status counts, pickups today, utilisation)       |
| GET    | `/fleet/vehicles`                 | Inventory w/ `location`, `search`, pageable                  |
| GET    | `/fleet/vehicles/export`          | CSV inventory                                                |
| GET    | `/fleet/vehicles/{id}/history`    | Same history feed as above                                   |
| POST   | `/fleet/vehicles/{id}/maintenance`| `{type, description, scheduledDate, cost?, odometerReading?, garage?}` — future → `SCHEDULED`, today/past → `IN_PROGRESS`; blocked on `RETIRED`/`RENTED` |
| GET    | `/fleet/vehicles/{id}/maintenance`| Maintenance log for a vehicle                                |
| PATCH  | `/fleet/maintenance/{id}/complete`| `{completedDate?, cost?, odometerReading?, notes?, releaseVehicle}` — releasing an `IN_PROGRESS` maintenance returns the vehicle to `AVAILABLE` |
| GET    | `/fleet/maintenance`              | All maintenance, pageable                                    |
| POST   | `/vehicles/{id}/damage`           | (above) `CRITICAL` damage on an `AVAILABLE` vehicle forces `MAINTENANCE` |
| PATCH  | `/fleet/damage/{id}`              | `{status, actualRepairCost?}` — REPORTED → UNDER_REPAIR → REPAIRED/WRITTEN_OFF |
| GET    | `/fleet/damage`                   | All damage records, pageable                                 |
| GET    | `/fleet/bookings`                 | Bookings w/ `status` filter                                  |
| GET    | `/fleet/pickups`                  | `?date=` pickups for the desk                                |

## Admin & reports

| Method | Path                       | Auth  | Notes                                                          |
|--------|----------------------------|-------|----------------------------------------------------------------|
| GET    | `/admin/dashboard`         | ADMIN | Platform KPIs computed from live data (never hard-coded)       |
| GET    | `/admin/audit-logs`        | ADMIN | Audit trail page                                               |
| GET    | `/reports/revenue`         | FM/ADMIN | `?from&to&groupBy=day|week|month|category|branch&category&branch` → `{totals{grossRevenue, refunds, netRevenue, counts, depositHeld}, series[], byCategory[], byBranch[], byMonth[]}`; `422 INVALID_GROUP_BY` otherwise |
| GET    | `/reports/revenue/export`  | FM/ADMIN | CSV of the series                                            |
| GET    | `/reports/utilisation`     | FM/ADMIN | `?periodDays` → `{periodDays, fleetUtilisationPercent, fleetRentedDays, fleetAvailableDays, vehicles[{vehicleId, vehicleName, licensePlate, category, location, rentedDays, availableDays, bookingCount, utilisationPercent, revenue, status}]}` |
| GET    | `/reports/utilisation/export` | FM/ADMIN | CSV                                                     |

## Misc

| Method | Path                 | Notes                                                        |
|--------|----------------------|--------------------------------------------------------------|
| GET    | `/dashboard/customer`| Customer home aggregates (spend, upcoming trips, unread)     |
| GET    | `/actuator/health`   | Liveness for deployment probes                               |
| GET    | `/v3/api-docs`       | OpenAPI 3 document (also drives `/swagger-ui.html`)          |

### cURL quickstart

```bash
# login (stores nothing server-side; keep the access token)
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@driveease.app","password":"Passw0rd!"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')

# search SUVs available next month
curl -s "http://localhost:8080/api/v1/vehicles?category=SUV&pickupDate=2026-10-20&returnDate=2026-10-24" \
  -H "Authorization: Bearer $TOKEN"
```

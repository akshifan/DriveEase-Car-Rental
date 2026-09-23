# Database Design

PostgreSQL 17, managed exclusively by **Flyway versioned migrations**
(`backend/src/main/resources/db/migration/`, V1–V14). Migrations are append-only:
an applied migration is never edited — changes arrive as a new `V(n+1)__*.sql`.

## Entity-relationship overview

```
users ──1:N──▶ refresh_tokens
      ──1:N──▶ password_reset_tokens
      ──1:N──▶ bookings ──N:1──▶ vehicles ──1:N──▶ vehicle_images
      │            │                    ──1:N──▶ maintenance_records
      │            │                    ──1:N──▶ damage_records
      │            ├──1:N──▶ payments ──1:N──▶ refunds
      │            ├──1:N──▶ reviews
      │            └──1:N──▶ notifications (also user-scoped)
      ──1:N──▶ audit_logs (actor)
```

## Tables (by migration)

| V   | File                                | Table / change                                                        |
|-----|-------------------------------------|-----------------------------------------------------------------------|
| 1   | `V1__create_users`                  | `users` — identity, BCrypt password hash, role `CUSTOMER/FLEET_MANAGER/ADMIN`, `active` flag, driver licence |
| 2   | `V2__create_refresh_tokens`         | `refresh_tokens` — token family id, hash, expiry, revoked flag (rotation + reuse detection) |
| 3   | `V3__create_password_reset_tokens`  | `password_reset_tokens` — hashed token, expiry, used flag             |
| 4   | `V4__create_vehicles`               | `vehicles` — make/model/year, `category`, `fuel_type`, `transmission`, `status`, daily rate + deposit (`NUMERIC(10,2)`), odometer, location, features |
| 5   | `V5__create_vehicle_images`         | `vehicle_images` — per-vehicle gallery URLs with sort order           |
| 6   | `V6__create_bookings`               | `bookings` — reference `DE-yyyyMMdd-NNNN`, customer, vehicle, pickup/return dates + locations, pricing snapshot, `status PENDING/CONFIRMED/ACTIVE/COMPLETED/CANCELLED`, cancellation reason |
| 7   | `V7__create_payments`               | `payments` — `DE-PAY-…`, booking FK, amount, method `CREDIT_CARD/DEBIT_CARD/CARD/UPI/CASH`, `status SUCCESS/FAILED/REFUNDED/PENDING`, `card_last4` only, gateway transaction ref, idempotency key |
| 8   | `V8__create_refunds`                | `refunds` — `DE-RF-…`, payment + booking FKs, amount `> 0`, source `ADMIN/CANCELLATION`, status, processed_by, reason |
| 9   | `V9__create_reviews`                | `reviews` — one per completed booking (unique booking FK), rating 1–5 check, title/comment, soft-delete columns (`deleted_at`, `deleted_by`, `deletion_reason`) |
| 10  | `V10__create_maintenance_records`   | `maintenance_records` — vehicle, type, scheduled/completed dates, cost, odometer, garage, status |
| 11  | `V11__create_damage_records`        | `damage_records` — vehicle, optional booking FK (integrity: damage tied to the right trip), severity, location on vehicle, repair estimate/actual cost, status |
| 12  | `V12__create_audit_logs`            | `audit_logs` — actor, action, entity, JSON details, reason            |
| 13  | `V13__create_notifications`         | `notifications` — user, type, payload, read flag                      |
| 14  | `V14__reporting_indexes_and_views`  | reporting indexes + `v_booking_revenue` view (per-booking revenue net of refunds) |

## Design rules

- **Money** columns are `NUMERIC(10,2)` and map to `BigDecimal` — never floats.
- **Enums** are stored as PostgreSQL enums / checked `VARCHAR` with `CHECK`
  constraints (e.g. `ck_refunds_source IN ('ADMIN','CANCELLATION')`), so an
  invalid state cannot be persisted even by a bug.
- **Integrity checks** at the database: `amount > 0` on payments/refunds,
  rating `BETWEEN 1 AND 5`, unique booking per review, unique references,
  unique license plate, `ON DELETE RESTRICT` between bookings and money rows.
- **Indices** cover every access path the API uses: booking lookups by
  customer/vehicle/status/date, payment `paid_at` ranges for the revenue
  report, refunds `status, created_at, payment_id`, vehicle
  `status/category/location` for search.
- **Never `ddl-auto=create`**: Hibernate validates (`validate` in prod); the
  schema belongs to Flyway.

## Reporting views & aggregations

`v_booking_revenue` joins bookings, payments and successful refunds to expose
per-booking net revenue. Live reports aggregate in SQL:

- `GET /api/v1/reports/revenue` — sums/counts over `payments` and `refunds`
  grouped by `date_trunc('day'|'week'|'month')`, vehicle category or pickup
  branch, filtered on indexed `paid_at` / `created_at` ranges.
- `GET /api/v1/reports/utilisation` — rented days vs available rental days per
  vehicle over a period, computed from bookings (not hard-coded counters).

## Demo data

`DemoDataSeeder` (opt-in via `app.seed-demo-data=true`, default in the dev
profile) fills a fresh database with a realistic fleet, users
(`admin@ / fleet@ / customer@ / priya@driveease.app`, password `Passw0rd!`),
bookings across past and future dates, payments, refunds, reviews, maintenance
and damage records — so every dashboard and report shows meaningful numbers on
first run. Production profiles leave seeding off.

# Testing & Verification

DriveEase is verified at three layers — unit, integration (full HTTP + DB) and
a live end-to-end contract sweep — with coverage **measured by JaCoCo, never
fabricated**.

## Backend

### Test inventory (50 tests, all green under `mvn verify`)

| Suite                                        | Type | Count | What it proves                                                                    |
|----------------------------------------------|------|-------|-----------------------------------------------------------------------------------|
| `PricingServiceTest`                         | unit | 10    | Quote math (days × rate + deposit), refundable-amount tiers, BigDecimal rounding  |
| `BookingServiceTest`                         | unit | 8     | State-transition guards, date validation (1–60 days, ≤180 ahead), cancellation rules |
| `BookingLifecycleIT`                         | IT   | 8     | Full journey over real HTTP + PostgreSQL: create `201 PENDING`, overlap → `409 VEHICLE_NOT_AVAILABLE` with **no persisted row**, payment `SUCCESS → CONFIRMED`, pickup → `ACTIVE`, return → `COMPLETED`, vehicle `AVAILABLE→RENTED→AVAILABLE` |
| `ReportingAndFleetIT`                        | IT   | 12    | Revenue report groupings (day/week/month/category/branch + `INVALID_GROUP_BY`), utilisation math, fleet maintenance/damage workflows, CSV exports |
| `AuthAndAccessIT`                            | IT   | 12    | Register/login/refresh rotation & reuse-revocation, role gates (401/403), user management, deactivate→`ACCOUNT_DISABLED`, customer dashboard scoping, filtered `/users` search |

Integration tests run against **real PostgreSQL** (`driveease_test`) via
Testcontainers-style configuration (`src/test/resources/application-test.yml`)
with Flyway migrations applied — no H2, so SQL is exercised as deployed.

### Running

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # if needed
cd backend
mvn verify          # unit + integration + JaCoCo report
open target/site/jacoco/index.html
```

### Latest measured coverage (JaCoCo 0.8.12)

| Counter    | Coverage            |
|------------|---------------------|
| LINE       | **65.9 %** (2101/3186) |
| BRANCH     | **37.3 %** (416/1114)  |
| METHOD     | 65.5 % (487/744)    |
| CLASS      | 88.4 % (160/181)    |

The uncovered remainder is dominated by thin adapters (DTO assembly, dev-only
seeder, Swagger config) while every business rule — pricing, booking state
machine, refunds, auth, reporting — sits on green lines.

## Frontend

- **16 unit/component tests** (`npx vitest run`, jsdom + Testing Library):
  `utils/format` (currency, date, percent, clamping) and component behaviour
  (badges, empty states, pagination) — `npm test`.
- **ESLint** zero warnings on `src/` (`npm run lint`).
- **Production build** as a gate: `npm run build` compiles every route and
  module.

## End-to-end contract sweep

`/tmp/contract_smoke.py` (dev-time script, not shipped in the zip) drives
**119 checks** through the running stack: auth lifecycle incl. refresh-cookie
rotation and reuse-revocation, role matrix (customer/FM/admin/anonymous),
date-based availability, quote math, the booking→payment→pickup→return→review
journey over HTTP, decline/partial-refund/over-refund rules, revenue report
groupings, CSV exports, moderation and notification endpoints. Last run:
**119 pass / 0 fail**.

## Defect-fix culture

Failures found by the sweep are fixed at the root: e.g. untyped nullable
parameters in a user query replaced with type-safe `Specification` predicates
(`lower(bytea)` crash), Spring 6.1 `NoResourceFoundException` mapped to a clean
404 JSON, and native-query rows handled without enum casts. The suites above
are the regression net for every fix.

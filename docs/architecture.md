# DriveEase Architecture

DriveEase is a full-stack car-rental platform: a React single-page application
served by Vite, talking to a Spring Boot 3 REST API over `/api/v1`, backed by
PostgreSQL with Flyway-managed migrations.

```
┌──────────────────────────┐        HTTPS (JSON)         ┌────────────────────────────┐
│  React 18 SPA (Vite)     │  ─────────────────────────▶ │  Spring Boot 3 REST API    │
│  React Router · Context  │   Bearer access token +     │  Spring Security (JWT)     │
│  Three.js + GSAP + Lenis │   HttpOnly refresh cookie   │  Spring Data JPA           │
└──────────────────────────┘                             │  Flyway · Bean Validation  │
                                                         └─────────────┬──────────────┘
                                                                       │ JDBC (Hikari)
                                                               ┌───────▼───────┐
                                                               │  PostgreSQL   │
                                                               └───────────────┘
```

## Backend layering

Strict one-way dependency: **Controller → Service → Repository**. Controllers
never touch repositories or JPA entities directly, and JPA entities are never
serialised to the network — every endpoint exchanges request/response DTO
records validated with Bean Validation.

```
web request
   │
   ▼
JwtAuthenticationFilter ──▶ SecurityConfig (authorisation rules)
   │
   ▼
@Controller  (thin: bind + validate input, delegate, wrap response)
   │  DTO in (record + @Valid)
   ▼
@Service     (business rules, transactions, state machines, pricing)
   │  entities
   ▼
@Repository  (Spring Data JPA, Specifications, aggregation queries)
   │
   ▼
DTO out (mapper methods assemble response records) ──▶ JSON
```

Key packages under `backend/src/main/java/com/driveease/`:

| Package        | Contents                                                                 |
|----------------|--------------------------------------------------------------------------|
| `controller`   | 10 REST controllers (`Auth`, `User`, `Vehicle`, `Booking`, `Payment`, `Review`, `Report`, `Fleet`, `Admin`, `Dashboard`) |
| `service`      | Business logic — `PricingService`, `BookingService`, `PaymentService`, `RefundService`, `ReportService`, `VehicleHistoryService`, `SandboxPaymentGateway`, `EmailService`, `NotificationService`, `AuditService`, `ScheduledJobs` |
| `repository`   | Spring Data interfaces + `spec/` (JPA `Specification` builders for dynamic filtering) |
| `dto`          | Request/response records grouped by domain (`auth`, `booking`, `payment`, `vehicle`, `review`, `user`, `report`, `common`) |
| `entity`       | JPA entities and enums (`BookingStatus`, `VehicleStatus`, `PaymentStatus`, `PaymentMethod`, `DamageStatus`, …) |
| `exception`    | `ApiException` hierarchy + `GlobalExceptionHandler` (`@RestControllerAdvice`) |
| `security`     | `JwtService`, `JwtAuthenticationFilter`, `SecurityUtils`, refresh-token services |
| `config`       | `SecurityConfig`, OpenAPI, CORS, cookie properties, seeding configuration |
| `bootstrap`    | `DemoDataSeeder` (opt-in demo data for local runs)                       |
| `util`         | `ReferenceGenerator` (`DE-…` references), `CsvWriter` (RFC-escaped CSV)  |

## Request lifecycle

1. `CorsFilter` applies the configured origin allow-list (`app.cors.*`).
2. `JwtAuthenticationFilter` validates the `Authorization: Bearer` header and
   populates the `SecurityContext`; no session state is kept.
3. `SecurityConfig` authorises the route: `/auth/*`, public `GET /vehicles`,
   reviews reads, Swagger and `/actuator/health` are public; `/admin/**` needs
   `ADMIN`; `/fleet/**` and `/reports/**` need `FLEET_MANAGER` or `ADMIN`;
   everything else requires authentication. Privileged service methods carry a
   second `@PreAuthorize` guard, so a mis-configured route cannot leak data.
4. Bean Validation runs on `@Valid` request bodies; violations become a
   structured 400 with per-field errors.
5. Services enforce business invariants (booking state machine, refund budget,
   review eligibility) and raise typed `ApiException`s (`409 VEHICLE_NOT_AVAILABLE`,
   `422 INVALID_GROUP_BY`, …).
6. `GlobalExceptionHandler` converts every failure into one JSON shape and
   guarantees stack traces never reach the client:

```json
{
  "timestamp": "2026-09-22T21:40:21.439152111",
  "status": 422,
  "code": "AMOUNT_MISMATCH",
  "message": "Payment amount 47500.00 does not match the booking total of 19300.00.",
  "path": "/api/v1/payments"
}
```

Validation failures add `"fieldErrors": { "field": "message" }`. Unknown paths
return the same shape with code `ENDPOINT_NOT_FOUND` (404) instead of a stack
trace.

## Backend-authoritative data

- **Filtering, sorting, pagination happen in the database.** Vehicle search,
  user search, admin booking/payment/review lists use JPA `Specification`s and
  `Pageable`s — the app never fetches all rows and filters in Java. Reporting
  uses SQL aggregation (`GROUP BY`, `date_trunc`) against indexed columns.
- **Money is `BigDecimal` everywhere.** `PricingService` is the single source
  of quotes (`days × daily rate + refundable deposit`); no `double`/`float`
  touches an amount.
- **State transitions are explicit.** Booking, vehicle, payment and damage
  status changes go through guarded service methods that reject illegal
  transitions with `422 INVALID_BOOKING_STATE`.
- **Audit trail.** Staff/admin actions (refunds, moderation, retirement,
  status changes) are appended to `audit_logs` with the acting user, JSON
  details and a reason.

## Cross-cutting services

| Concern      | Design                                                                            |
|--------------|-----------------------------------------------------------------------------------|
| Email        | `EmailService` abstraction; `mock` provider logs in dev, SMTP provider pluggable via `app.email.*` config — no hard-coded credentials |
| Payments     | `PaymentGateway` interface with the `SandboxPaymentGateway` default; a real PSP is a configuration swap. Card numbers/CVV are never accepted or stored — only the instrument type and last four digits |
| Notifications| In-app notification rows written on booking/payment events, read via `/users/me/notifications` |
| Scheduling   | `ScheduledJobs` performs time-based housekeeping (e.g. flagging overdue pickups)  |

## Frontend architecture

```
frontend/src/
├── api/          fetch client (refresh-and-retry, ApiError) + per-domain modules
├── animations/   smoothScroll (Lenis), scrollTimelines (GSAP), revealAnimations
├── three/        DriveEaseScene, CarModel, CarCamera, CarLighting,
│                 CarScrollController, WebGLFallback
├── context/      AuthContext, ToastContext (+ reducers)
├── hooks/        useApiResource, useDebouncedValue, useEscapeKey, useFocusTrap, …
├── components/   ui/ (design system), layout/, vehicles/, booking/
├── pages/        public/, auth/, customer/, console/ (fleet manager), admin/
├── styles/       Tailwind entry + design-system classes
└── utils/        constants, format (currency/date/percent/CSV-safe), datetime, damage
```

- **JSX only** — no TypeScript anywhere; every component is `Component.jsx`.
- **State** is React hooks + Context for genuinely shared state (auth session,
  toasts). No Redux, no server-state cache — `useApiResource` handles
  fetch/refresh/error/lifecycle per view.
- **Routing** is React Router v6 with lazy-loaded routes per role area.
  `landingRouteFor` sends each role to its home (`/admin`, `/console`,
  `/dashboard`); route guards check the session and role client-side for UX,
  while the API remains the real authority.
- **API client** (`src/api/client.js`) attaches the bearer token, transparently
  refreshes expired access tokens once and replays the request, converts every
  non-2xx into `ApiError {status, code, message, fieldErrors}` and supports
  bodies on `DELETE` (review moderation).

Dev/preview traffic goes through the Vite proxy (`/api → http://localhost:8080`)
so the browser only ever sees same-origin requests; in production the SPA calls
`VITE_API_BASE_URL` directly with CORS locked to the deployed origin.

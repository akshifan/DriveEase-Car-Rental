# The Booking Engine

The booking engine is the heart of DriveEase: a backend-authoritative state
machine that coordinates customers, fleet operations, payments and vehicle
availability without ever trusting the client.

## Lifecycle

```
            POST /bookings                 payment SUCCESS
  (customer) ─────────────▶  PENDING ─────────────────────▶  CONFIRMED
                              │    │                            │
              POST /cancel    │    │ payment FAILED             │ PATCH /bookings/{id}/status
              (auto refund)   ▼    ▼ (stays PENDING)           │ {status: ACTIVE}  ← pickup
                          CANCELLED                            ▼
                                                                ACTIVE
                                                                │ {status: COMPLETED} ← return
                                                                ▼
                                                             COMPLETED ──▶ review window
```

- Created bookings are **`PENDING`** and hold no money.
- A **successful payment** (`POST /payments` → `SUCCESS`) confirms the booking
  atomically in one transaction (`PENDING → CONFIRMED`).
- A **declined** payment records a `FAILED` payment row with `failureReason`
  and leaves the booking `PENDING` so the customer can retry.
- **Pickup** (fleet console, `PATCH /bookings/{id}/status {status:"ACTIVE"}`)
  transitions `CONFIRMED → ACTIVE` and the vehicle `AVAILABLE → RENTED`.
- **Return** (`{status:"COMPLETED"}`) completes the trip, releases the vehicle
  back to `AVAILABLE` and opens the review window.
- Illegal jumps (e.g. `COMPLETED → CANCELLED`, `PENDING → ACTIVE`) are rejected
  with `422 INVALID_BOOKING_STATE`.

## Availability & the 409 rule

- A rental window is **half-open**: `[pickupDate, returnDate)` — returning on a
  date frees the car for that same day.
- Overlap between two non-cancelled bookings of the same vehicle is impossible:
  creation checks conflicts **inside the same transaction that inserts**, with
  a `PESSIMISTIC_WRITE` lock on the vehicle row so two concurrent requests
  cannot both pass the check.
- Any overlap answers `409 CONFLICT` with code `VEHICLE_NOT_AVAILABLE` and
  nothing is persisted.
- Constraints enforced at creation: rental length 1–60 days
  (`BOOKING_MAX_RENTAL_DAYS`), start up to 180 days ahead
  (`BOOKING_MAX_ADVANCE_DAYS`), pickup not in the past, return after pickup.
- The vehicle stays `AVAILABLE` (and bookable by others) until physical pickup;
  a `RENTED`/`MAINTENANCE` vehicle can still hold *future* bookings, but the
  overlap guard plus status checks keep the calendar consistent.

## Pricing — `PricingService`

All arithmetic is `BigDecimal` (scale 2, `HALF_UP`); no binary floating point
ever represents money.

```
totalAmount = baseAmount + depositAmount
baseAmount  = totalDays × dailyRate          (vehicle snapshot at creation)
depositAmount = vehicle.holdDeposit          (refundable security hold)
```

The quote is computed up-front (`POST /bookings/quote`) and snapshotted onto
the booking, so later catalogue price changes never mutate existing bookings.
Payments must match the outstanding total exactly — mismatches are rejected
with `422 AMOUNT_MISMATCH`.

**Cancellation refunds** (sandbox policy implemented in `PricingService.refundableAmount`):

| Time before pickup            | Refund of paid amount            |
|-------------------------------|----------------------------------|
| ≥ 5 days (`REFUND_FULL_DAYS`) | 100 %                             |
| 1–4 days before pickup        | deposit + prorated rental refund |
| < 24 h / no-show              | deposit only (or none per table) |

Cancelling a paid booking writes a `CANCELLATION`-source refund and marks the
payment `REFUNDED` when fully refunded; the refund ledger records the actor,
amount and reason. A duplicate cancellation refund is impossible (one
`CANCELLATION` refund per booking is enforced).

## Payments & receipts

- `POST /payments` runs the sandbox gateway: declines when the amount exceeds
  the configured failure threshold, card last-4 is `0000`, or a UPI handle
  contains `fail` — deterministic, testable failure modes without real money.
- Every attempt (success or decline) is persisted with a `DE-PAY-…` reference
  and gateway transaction ref; receipts are addressed `RCPT-<paymentReference>`.
- Refunds (`ADMIN` or cancellation flow) are partial-capable: cumulative
  refunds can never exceed the original amount (`409` beyond budget), full
  refund moves the payment to `REFUNDED`, and the processed actor is stored.
- Card data is never accepted beyond the last four digits — no PAN, no CVV,
  no expiry — enforced by the DTO contract itself.

## Fleet coordination

- Pickup/return flows live in the fleet console (`/console`): a pickups-today
  desk view, mileage capture on return, condition/damage logging.
- Maintenance and damage interact with availability: scheduling maintenance on
  a vehicle blocks new bookings; `CRITICAL` damage on an `AVAILABLE` vehicle
  forces `MAINTENANCE`; completing maintenance returns the vehicle to
  `AVAILABLE` unless explicitly held (`releaseVehicle=false`).
- Every status change lands in the vehicle history feed
  (`GET /vehicles/{id}/history`) next to trips, services and damage events.

## Testing the engine

`BookingLifecycleIT` walks the full HTTP-level journey (create → overlap 409 →
pay → pickup → return → review) and `BookingServiceTest` covers pricing and
state rules at unit level — see `docs/testing.md`.

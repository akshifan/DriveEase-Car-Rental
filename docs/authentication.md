# Authentication & Authorisation

Stateless JWT authentication with rotating refresh tokens, backed by Spring
Security 6. There are no server sessions; every request is authorised from the
bearer token, and privileged operations are re-checked at the service layer.

## Roles

| Role            | Home route   | Can                                                                    |
|-----------------|--------------|------------------------------------------------------------------------|
| `CUSTOMER`      | `/dashboard` | Discovery, bookings, payments, reviews, own profile & notifications     |
| `FLEET_MANAGER` | `/console`   | Fleet dashboard, vehicles, maintenance, damage, pickups/returns, reports |
| `ADMIN`         | `/admin`     | Everything: users, fleet, bookings, payments/refunds, reviews, reports, audit logs |

## Tokens

- **Access token** — HS256 JWT, 1 h default (`JWT_ACCESS_EXPIRATION`,
  configurable), carries subject (user id), email, role. Sent as
  `Authorization: Bearer …`; validated by `JwtAuthenticationFilter`.
- **Refresh token** — opaque random value, **hashed at rest** in
  `refresh_tokens`, delivered only as an **HttpOnly, Secure, SameSite=Lax
  cookie** scoped to path `/api/v1/auth` (`driveease_refresh`). JavaScript can
  never read it; it rides only on auth calls.
- **Rotation with reuse detection** — every `POST /auth/refresh` invalidates the
  presented token and issues a new one from the same *family*. Presenting an
  already-rotated token revokes the entire family (possible theft → all
  sessions die) and answers 401.
- **Logout** revokes the presented refresh token and clears the cookie.
- Deactivating a user (`PATCH /users/{id}/status {active:false}`) blocks new
  logins (`403 ACCOUNT_DISABLED`) and revokes live refresh tokens.

## Flows

**Register / Login**

```
POST /api/v1/auth/register {email, password, firstName, lastName, phone}
POST /api/v1/auth/login    {email, password}
  → 200 {accessToken, tokenType:"Bearer", expiresIn, user}
  ← Set-Cookie: driveease_refresh=…; HttpOnly; SameSite=Lax; Path=/api/v1/auth
```

**Silent renewal (frontend)**

`src/api/client.js` intercepts any 401 (except on `/auth/*`), calls
`POST /auth/refresh` once (cookie rides along), replaces the access token and
replays the original request. Concurrent failures share one refresh in flight;
a failed refresh clears the session and routes to login.

Because `/auth/refresh` returns only tokens, the fresh profile is fetched from
`GET /auth/session` after renewal.

**Password reset**

```
POST /auth/forgot-password {email}
  → generic {message} (never reveals whether the account exists)
  → dev/mock email provider logs the link; the response also carries
    {resetToken, expiresInMinutes} so the flow is demonstrable without SMTP
POST /auth/reset-password {token, newPassword}
  → 400 INVALID_RESET_TOKEN | RESET_TOKEN_EXPIRED on failure
```

Tokens are stored hashed with an expiry and single-use. Passwords are hashed
with `DelegatingPasswordEncoder`/BCrypt and never logged.

## Authorisation model

**Route level** (`SecurityConfig`):

- Public: register, login, refresh, forgot/reset, `GET /vehicles` (list/detail/
  facets), review reads, `/v3/api-docs`, `/swagger-ui`, `/actuator/health`.
- `ADMIN`: `/admin/**`, `/users/**` management, `POST /users/staff`.
- `FLEET_MANAGER or ADMIN`: `/fleet/**`, `/reports/**`, vehicle mutations,
  damage, history.
- Everything else: authenticated.

**Method level**: privileged services repeat `@PreAuthorize("hasRole(...)")`
so a routing mistake cannot expose an operation. The frontend mirrors roles
only for navigation/UX — the server is the sole authority (verified by the
auth-z smoke checks: customer→admin 403, FM→users 403, anonymous→401).

## Configuration

| Env var                   | Default            | Meaning                              |
|---------------------------|--------------------|--------------------------------------|
| `JWT_SECRET`              | (required in prod) | HS256 signing key — never committed  |
| `JWT_ACCESS_EXPIRATION`   | `3600` s           | Access token life                    |
| `JWT_REFRESH_EXPIRATION`  | `1209600` s (14 d) | Refresh token life                   |
| `COOKIE_SECURE`           | `true` in prod     | Secure flag on the refresh cookie    |
| `COOKIE_SAME_SITE`        | `Lax`              | CSRF posture                         |
| `PASSWORD_RESET_EXPIRATION` | `30` min         | Reset token life                     |

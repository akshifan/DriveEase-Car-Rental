# Deployment Guide

Target topology (free/developer-tier friendly, no containers required):

```
Vercel (static SPA)  ──HTTPS──▶  Spring Boot JAR on a small VM/PaaS  ──▶  Managed PostgreSQL
frontend/driveease.app            api.driveease.app                      (Flyway migrates on boot)
```

## 1. Database — managed PostgreSQL

Provision any managed PostgreSQL (Neon, Supabase, RDS, Aiven — all have free
tiers). Collect the JDBC URL and credentials.

- Flyway runs all migrations automatically on application start; **do not run
  SQL by hand** and never set `ddl-auto` above `validate`.
- Verify provider compatibility: PostgreSQL 14+ works with the shipped Flyway
  10.17.0 / PostgreSQL driver.

## 2. Backend — Spring Boot JAR

```bash
cd backend
mvn clean package                 # runs the 50-test suite first
java -jar target/driveease-api-1.0.0.jar --spring.profiles.active=prod
```

Deploy the same JAR to any Java 21 runtime (Render, Railway, Fly.io machines,
an EC2/Lightsail VM with systemd). Health probe: `GET /actuator/health`.

**Required environment (secrets via the platform's secret store — never in Git):**

| Variable                  | Example                                  |
|---------------------------|------------------------------------------|
| `DB_URL`                  | `jdbc:postgresql://host:5432/driveease`  |
| `DB_USERNAME` / `DB_PASSWORD` | managed-DB credentials               |
| `JWT_SECRET`              | long random string (≥ 64 chars)          |
| `FRONTEND_URL` / `APP_BASE_URL` | `https://driveease.app` / API base |
| `COOKIE_SECURE`           | `true`                                   |
| `PAYMENT_GATEWAY_MODE`    | `SANDBOX` until a real PSP is wired      |
| `EMAIL_PROVIDER`          | `mock` or an SMTP provider config        |
| `SEED_DEMO_DATA`          | `false` in production                    |

Production profile essentials (`application-prod.yml`): CORS locked to the
exact frontend origin (never `*`), cookies `Secure`, secrets from env only,
errors returned as structured JSON without stack traces.

## 3. Frontend — Vercel

| Setting            | Value                                  |
|--------------------|----------------------------------------|
| Root directory     | `frontend`                             |
| Build command      | `npm run build`                        |
| Output directory   | `dist`                                 |
| Environment        | `VITE_API_BASE_URL=https://api.example.com/api/v1` |

Vercel serves the SPA; add the standard SPA rewrite (`vercel.json` or project
setting) `source: /(.*) → /index.html` so deep links like `/bookings/42`
survive refresh. The dev/preview proxy (`/api → :8080`) is dev-only; in
production the client calls `VITE_API_BASE_URL` directly.

**Verify before declaring victory**: `curl https://api.example.com/actuator/health`
returns `UP`, the SPA loads and can register/login against the API, and CORS
shows the exact origin — deployment is only "done" when those are observed,
not assumed.

## 4. Local setup (development)

```bash
# prerequisites: JDK 21, Maven 3.9+, Node 20+, PostgreSQL 14+
createdb driveease

cd backend
mvn spring-boot:run          # dev profile: Flyway migrates, demo data seeds

cd frontend
npm ci
cp .env.example .env         # optional: VITE_DEV_API_TARGET
npm run dev                  # http://localhost:5173 (proxies /api to :8080)
```

Demo logins (seeded): `admin@driveease.app`, `fleet@driveease.app`,
`customer@driveease.app`, `priya@driveease.app` — password `Passw0rd!`.

## 5. Operational notes

- **Migrations**: to change schema, add `V15__*.sql`; never edit applied files
  (checksum validation will fail the boot).
- **Logs**: secrets and passwords are never logged; the sandbox payment
  gateway logs only references and outcomes.
- **Scaling**: the API is stateless (JWT) — run N replicas behind a load
  balancer; the only shared state is PostgreSQL. Overlap locking relies on
  the database, which stays correct across replicas.
- **Backups**: standard managed-PostgreSQL PITR; the money trail (payments,
  refunds, audit logs) is append-only by design.

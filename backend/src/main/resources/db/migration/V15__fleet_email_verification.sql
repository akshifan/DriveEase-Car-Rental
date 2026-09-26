-- =============================================================================
-- V15 : self-service FLEET_MANAGER registration with email verification.
--
-- Fleet partners register publicly; the account is created with
-- email_verified = FALSE and cannot authenticate until they click the link we
-- email them. This is Option B (auto-approval) plus a minimal bot filter.
-- =============================================================================
ALTER TABLE users
  ADD COLUMN email_verified       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN verification_token   VARCHAR(128),
    ADD COLUMN verification_sent_at TIMESTAMP;

CREATE UNIQUE INDEX uq_users_verification_token
  ON users (verification_token)
  WHERE verification_token IS NOT NULL;

COMMENT ON COLUMN users.email_verified IS
    'FALSE for public fleet registrations until they click the emailed verification link. '
    'Existing/seeded accounts default to TRUE and are unaffected.';

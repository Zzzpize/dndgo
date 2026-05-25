ALTER TABLE users
  ADD COLUMN email_verified    BOOL        NOT NULL DEFAULT false,
  ADD COLUMN verify_code       VARCHAR(6),
  ADD COLUMN verify_expires_at TIMESTAMPTZ;

-- Mark all existing users as verified so current accounts keep working
UPDATE users SET email_verified = true;

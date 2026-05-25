ALTER TABLE users
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS verify_code,
  DROP COLUMN IF EXISTS verify_expires_at;

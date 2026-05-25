DROP TABLE IF EXISTS password_reset_tokens;

ALTER TABLE users
  DROP COLUMN IF EXISTS pending_email,
  DROP COLUMN IF EXISTS pending_email_code,
  DROP COLUMN IF EXISTS pending_email_expires_at;

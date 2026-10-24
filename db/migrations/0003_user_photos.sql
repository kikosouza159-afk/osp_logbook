ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_data BYTEA,
  ADD COLUMN IF NOT EXISTS photo_mime VARCHAR(80),
  ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_role_active_idx ON users(role, active);

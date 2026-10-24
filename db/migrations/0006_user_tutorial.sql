ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS users_tutorial_pending_idx
  ON users(role, tutorial_completed)
  WHERE active = TRUE;

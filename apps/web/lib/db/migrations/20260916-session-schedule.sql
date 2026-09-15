BEGIN;
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS session_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;
NOTIFY pgrst, 'reload schema';
COMMIT;

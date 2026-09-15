-- Run once before deploying the Masterclass pages; safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS coaches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS session_kind TEXT NOT NULL DEFAULT 'group'
  CHECK (session_kind IN ('group', 'masterclass'));
INSERT INTO coaches (name) VALUES ('Mohammad Abbas') ON CONFLICT (name) DO NOTHING;
INSERT INTO group_sessions (id, title, age_group, max_players, coach_name, schedule, price, session_kind)
VALUES ('masterclass-mohammad-abbas-sunday', 'Masterclass with Mohammad Abbas', '6-18 years', 12,
  'Mohammad Abbas', 'Sunday 1–3 pm', 40.00, 'masterclass')
ON CONFLICT (id) DO NOTHING;
COMMIT;

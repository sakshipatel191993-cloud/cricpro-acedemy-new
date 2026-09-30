BEGIN;

-- One anonymous browser session per London calendar day. No IP, user agent,
-- page URL, cookie, or customer identity is stored.
CREATE TABLE IF NOT EXISTS website_visits (
  visit_date DATE NOT NULL,
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_date, session_id)
);

ALTER TABLE website_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE website_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE website_visits TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

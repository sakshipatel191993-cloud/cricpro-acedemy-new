BEGIN;
ALTER TABLE group_session_bookings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending_payment', 'confirmed', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Pending checkout places count toward capacity until Stripe confirms expiry.
-- Use a row lock through UPDATE so simultaneous bookings cannot claim the last place.
CREATE OR REPLACE FUNCTION maintain_group_session_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE old_occupied boolean := false; new_occupied boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_occupied := OLD.status IN ('pending_payment', 'confirmed'); END IF;
  IF TG_OP <> 'DELETE' THEN new_occupied := NEW.status IN ('pending_payment', 'confirmed'); END IF;
  IF TG_OP = 'UPDATE' AND NEW.session_id <> OLD.session_id THEN
    RAISE EXCEPTION 'Moving a booking to another session is not supported' USING ERRCODE = '23514';
  END IF;
  IF new_occupied AND NOT old_occupied THEN
    UPDATE group_sessions SET current_players = current_players + 1
      WHERE id = NEW.session_id AND active = true AND current_players < max_players;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session is full or inactive' USING ERRCODE = '23514'; END IF;
  ELSIF old_occupied AND NOT new_occupied THEN
    UPDATE group_sessions SET current_players = greatest(0, current_players - 1) WHERE id = OLD.session_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS group_session_capacity ON group_session_bookings;
CREATE TRIGGER group_session_capacity BEFORE INSERT OR UPDATE OR DELETE ON group_session_bookings
  FOR EACH ROW EXECUTE FUNCTION maintain_group_session_capacity();
NOTIFY pgrst, 'reload schema';
COMMIT;

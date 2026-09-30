BEGIN;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_cancelled_at TIMESTAMPTZ;
ALTER TABLE group_session_bookings ADD COLUMN IF NOT EXISTS admin_cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS booking_cancellation_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_kind TEXT NOT NULL CHECK (booking_kind IN ('resource', 'group')),
  booking_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('cancelled', 'refund_succeeded', 'refund_failed')),
  snapshot JSONB NOT NULL,
  request JSONB,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'attention')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until TIMESTAMPTZ,
  first_send_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_kind, booking_id, event_type)
);
CREATE INDEX IF NOT EXISTS booking_cancellation_outbox_due ON booking_cancellation_outbox (next_attempt_at)
  WHERE state IN ('pending', 'sending');
ALTER TABLE booking_cancellation_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION enqueue_booking_cancellation_notice() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  kind TEXT := CASE WHEN TG_TABLE_NAME = 'bookings' THEN 'resource' ELSE 'group' END;
  event_name TEXT;
BEGIN
  IF NEW.admin_cancelled_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.admin_cancelled_at IS NULL AND NEW.status = 'cancelled' THEN
    event_name := 'cancelled';
  ELSIF OLD.admin_cancelled_at IS NOT NULL AND OLD.refund_status IS DISTINCT FROM NEW.refund_status THEN
    IF NEW.refund_status = 'succeeded' THEN event_name := 'refund_succeeded';
    ELSIF NEW.refund_status IN ('failed', 'canceled') THEN event_name := 'refund_failed';
    END IF;
  END IF;
  IF event_name IS NOT NULL THEN
    INSERT INTO booking_cancellation_outbox (booking_kind, booking_id, event_type, snapshot)
      VALUES (kind, NEW.id::TEXT, event_name, jsonb_build_object(
        'payment_status', NEW.payment_status, 'refund_status', NEW.refund_status,
        'amount', NEW.amount, 'stripe_refund_id', NEW.stripe_refund_id))
      ON CONFLICT (booking_kind, booking_id, event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_admin_cancellation_notice ON bookings;
CREATE TRIGGER booking_admin_cancellation_notice AFTER UPDATE OF admin_cancelled_at, refund_status ON bookings
  FOR EACH ROW EXECUTE FUNCTION enqueue_booking_cancellation_notice();
DROP TRIGGER IF EXISTS group_admin_cancellation_notice ON group_session_bookings;
CREATE TRIGGER group_admin_cancellation_notice AFTER UPDATE OF admin_cancelled_at, refund_status ON group_session_bookings
  FOR EACH ROW EXECUTE FUNCTION enqueue_booking_cancellation_notice();

CREATE OR REPLACE FUNCTION claim_booking_cancellation_notices(p_limit INTEGER DEFAULT 10)
RETURNS SETOF booking_cancellation_outbox
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE booking_cancellation_outbox SET state = 'attention'
    WHERE state IN ('pending', 'sending') AND first_send_at < now() - interval '23 hours';
  RETURN QUERY UPDATE booking_cancellation_outbox o
    SET state = 'sending', lease_until = now() + interval '5 minutes', attempts = attempts + 1
    WHERE o.id IN (
      SELECT q.id FROM booking_cancellation_outbox q
      WHERE q.state IN ('pending', 'sending') AND q.next_attempt_at <= now()
        AND (q.lease_until IS NULL OR q.lease_until < now())
      ORDER BY q.next_attempt_at FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 20))
    ) RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION claim_booking_cancellation_notices(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_booking_cancellation_notices(INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_status TEXT CHECK (refund_status IN ('pending', 'succeeded', 'failed', 'canceled'));

ALTER TABLE group_session_bookings
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_status TEXT CHECK (refund_status IN ('pending', 'succeeded', 'failed', 'canceled'));

ALTER TABLE group_session_bookings DROP CONSTRAINT IF EXISTS group_session_bookings_payment_status_check;
ALTER TABLE group_session_bookings ADD CONSTRAINT group_session_bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_refund_id_unique ON bookings (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS group_session_bookings_stripe_refund_id_unique ON group_session_bookings (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;

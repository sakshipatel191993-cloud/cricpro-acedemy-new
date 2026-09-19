-- CricPro Academy Database Setup
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('public', 'authenticated', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Resource types
DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM ('lane', 'bowling_machine', 'side_arm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Service types
DO $$ BEGIN
    CREATE TYPE service_type AS ENUM ('lane_hire', 'group_session', 'bowling_machine', 'side_arm', 'coaching', 'birthday_party');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Booking statuses
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'completed', 'expired', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment statuses
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Inquiry statuses
DO $$ BEGIN
    CREATE TYPE inquiry_status AS ENUM ('new', 'contacted', 'converted', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Inquiry types
DO $$ BEGIN
    CREATE TYPE inquiry_type AS ENUM ('coaching', 'birthday_party', 'contact', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Email statuses
DO $$ BEGIN
    CREATE TYPE email_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role user_role DEFAULT 'authenticated' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Resources
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    type resource_type NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    capacity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    booking_reference TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES users(id),
    resource_id TEXT NOT NULL REFERENCES resources(id),
    service_type service_type NOT NULL,
    booking_date TIMESTAMPTZ NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'pending_payment' NOT NULL,
    payment_status payment_status DEFAULT 'pending' NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    stripe_session_id TEXT,
    expires_at TIMESTAMPTZ,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    player_count INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Resource Availability Rules (define when resources operate)
CREATE TABLE IF NOT EXISTS resource_availability_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    day_of_week INTEGER NOT NULL, -- 0-6 (Sunday-Saturday)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_mins INTEGER DEFAULT 60,
    buffer_mins INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Pricing Rules (variable pricing based on time/day)
CREATE TABLE IF NOT EXISTS pricing_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days INTEGER[] NOT NULL, -- Array of day of week (0-6)
    price DECIMAL(10,2) NOT NULL,
    priority INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Slot Overrides (one-off changes for specific slots)
CREATE TABLE IF NOT EXISTS slot_overrides (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    slot_date DATE NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    custom_price DECIMAL(10,2),
    blocked BOOLEAN DEFAULT false NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Blocked slots
CREATE TABLE IF NOT EXISTS blocked_slots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Group sessions
CREATE TABLE IF NOT EXISTS group_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    age_group TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    current_players INTEGER DEFAULT 0,
    coach_name TEXT,
    schedule TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Group session bookings
CREATE TABLE IF NOT EXISTS group_session_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES group_sessions(id),
    player_name TEXT NOT NULL,
    player_age INTEGER,
    parent_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    emergency_contact TEXT,
    medical_notes TEXT,
    skill_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Inquiries
CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type inquiry_type NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status inquiry_status DEFAULT 'new' NOT NULL,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Email jobs
CREATE TABLE IF NOT EXISTS email_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    template TEXT NOT NULL,
    payload TEXT,
    status email_status DEFAULT 'pending' NOT NULL,
    attempts INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admin_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Resend webhook event ledger (idempotency + delivery audit)
CREATE TABLE IF NOT EXISTS resend_webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    resend_email_id TEXT,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resend_webhook_events_email_id_idx
    ON resend_webhook_events (resend_email_id)
    WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS resend_webhook_events_received_at_idx
    ON resend_webhook_events (received_at DESC);

-- =====================================================
-- EXCLUSION CONSTRAINT (Double-booking prevention)
-- =====================================================

-- Add exclusion constraint to prevent overlapping bookings
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at) WITH &&
)
WHERE (status IN ('confirmed', 'pending_payment'));

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_session_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resend_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE resend_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE resend_webhook_events TO service_role;

-- =====================================================
-- SEEDS - Default resources
-- =====================================================

-- Insert default resources (lanes)
INSERT INTO resources (id, name, type, active, capacity) VALUES
('lane-1', 'Lane 1', 'lane', true, 6),
('lane-2', 'Lane 2', 'lane', true, 6),
('lane-3', 'Lane 3', 'lane', true, 6),
('lane-4', 'Lane 4', 'lane', true, 6),
('bm-1', 'Bowling Machine 1', 'bowling_machine', true, 1),
('sa-1', 'Side Arm 1', 'side_arm', true, 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Tables created successfully!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
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

BEGIN;
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS session_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;
NOTIFY pgrst, 'reload schema';
COMMIT;

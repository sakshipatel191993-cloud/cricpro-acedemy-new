CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
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
    ON public.resend_webhook_events (resend_email_id)
    WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS resend_webhook_events_received_at_idx
    ON public.resend_webhook_events (received_at DESC);

ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resend_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.resend_webhook_events TO service_role;

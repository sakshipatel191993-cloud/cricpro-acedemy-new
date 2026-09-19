-- Additive only. Existing records have no opt-in; no historical jobs are queued.
alter table public.bookings add column if not exists whatsapp_consent jsonb;
alter table public.group_session_bookings add column if not exists whatsapp_consent jsonb;
alter table public.inquiries add column if not exists whatsapp_consent jsonb;

create table public.whatsapp_jobs (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('bookings', 'group_session_bookings', 'inquiries')),
  source_id text not null,
  phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
  event text not null check (event in ('booking_confirmed', 'enquiry_received')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'failed', 'ambiguous', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  message_id text unique,
  error text,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, event, phone)
);
create index whatsapp_jobs_pending on public.whatsapp_jobs(next_attempt_at) where status = 'pending';
create index whatsapp_jobs_processing on public.whatsapp_jobs(claimed_at) where status = 'processing';

create table public.whatsapp_opt_outs (
  phone text primary key check (phone ~ '^[1-9][0-9]{7,14}$'),
  stopped_at timestamptz not null default now()
);
-- Minimal delivery audit, not an inbox: never store message bodies/medical details.
create table public.whatsapp_delivery_events (
  id text primary key,
  message_id text not null,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index whatsapp_delivery_message on public.whatsapp_delivery_events(message_id);

alter table public.whatsapp_jobs enable row level security;
alter table public.whatsapp_opt_outs enable row level security;
alter table public.whatsapp_delivery_events enable row level security;
revoke all on public.whatsapp_jobs, public.whatsapp_opt_outs, public.whatsapp_delivery_events from public, anon, authenticated;
grant all on public.whatsapp_jobs, public.whatsapp_opt_outs, public.whatsapp_delivery_events to service_role;

-- Invoker privilege: no RLS bypass. The server inserts/updates these source rows.
create function public.queue_whatsapp_notification() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  consent jsonb := new.whatsapp_consent;
  event_name text;
begin
  if current_user not in ('service_role', 'postgres') then return new; end if;
  if consent is null or consent->>'version' is distinct from 'transactional-v1'
     or coalesce(consent->>'phone', '') !~ '^[1-9][0-9]{7,14}$'
     or consent->>'grantedAt' is null then return new; end if;
  if tg_table_name = 'inquiries' then
    event_name := 'enquiry_received';
  else
    -- Only a paid + confirmed booking is eligible (not abandoned checkout).
    if new.status::text <> 'confirmed' or new.payment_status::text <> 'paid' then return new; end if;
    event_name := 'booking_confirmed';
  end if;
  insert into public.whatsapp_jobs (source_table, source_id, phone, event)
  values (tg_table_name, new.id, consent->>'phone', event_name)
  on conflict (source_table, source_id, event, phone) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_whatsapp_notification() from public, anon, authenticated;
grant execute on function public.queue_whatsapp_notification() to service_role;

create trigger queue_booking_whatsapp after insert or update of status, payment_status
  on public.bookings for each row execute function public.queue_whatsapp_notification();
create trigger queue_group_whatsapp after insert or update of status, payment_status
  on public.group_session_bookings for each row execute function public.queue_whatsapp_notification();
create trigger queue_inquiry_whatsapp after insert
  on public.inquiries for each row execute function public.queue_whatsapp_notification();

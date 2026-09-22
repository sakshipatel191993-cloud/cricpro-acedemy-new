-- Apply only after isolated migration/RLS/concurrency verification and approval.
create table public.checkout_attempts (
  id text primary key,
  resource_booking_id text unique references public.bookings(id),
  group_booking_id text unique references public.group_session_bookings(id),
  params jsonb not null,
  stripe_session_id text unique,
  resolved boolean not null default false,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(resource_booking_id, group_booking_id) = 1)
);
create index checkout_attempts_pending on public.checkout_attempts(created_at) where not resolved;
alter table public.checkout_attempts enable row level security;
revoke all on public.checkout_attempts from public, anon, authenticated;
grant all on public.checkout_attempts to service_role;

create table public.booking_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  resource_booking_id text references public.bookings(id),
  group_booking_id text references public.group_session_bookings(id),
  recipient_role text not null check (recipient_role in ('customer','admin')),
  payment jsonb not null,
  request jsonb,
  state text not null default 'pending' check (state in ('pending','sending','sent','attention')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  first_send_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(resource_booking_id,group_booking_id) = 1),
  unique(resource_booking_id,recipient_role), unique(group_booking_id,recipient_role)
);
create index booking_notification_due on public.booking_notification_outbox(next_attempt_at) where state in ('pending','sending');
alter table public.booking_notification_outbox enable row level security;
revoke all on public.booking_notification_outbox from public, anon, authenticated;
grant all on public.booking_notification_outbox to service_role;

-- Invoker, no elevated privileges. Only the service role may call these RPCs.
create function public.attach_checkout_attempt(p_attempt_id text, p_session_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare a public.checkout_attempts%rowtype; current_session text; current_status text;
begin
  select * into strict a from public.checkout_attempts where id=p_attempt_id for update;
  if a.stripe_session_id is not null and a.stripe_session_id <> p_session_id then
    raise exception 'Conflicting checkout attempt';
  end if;
  if a.resource_booking_id is not null then
    select stripe_session_id,status into strict current_session,current_status from public.bookings where id=a.resource_booking_id for update;
    if current_status not in ('pending_payment','confirmed') or (current_session is not null and current_session <> p_session_id) then raise exception 'Invalid booking checkout state'; end if;
    update public.bookings set stripe_session_id=p_session_id where id=a.resource_booking_id;
  else
    select stripe_session_id,status into strict current_session,current_status from public.group_session_bookings where id=a.group_booking_id for update;
    if current_status not in ('pending_payment','confirmed') or (current_session is not null and current_session <> p_session_id) then raise exception 'Invalid booking checkout state'; end if;
    update public.group_session_bookings set stripe_session_id=p_session_id where id=a.group_booking_id;
  end if;
  update public.checkout_attempts set stripe_session_id=p_session_id where id=a.id;
end $$;

-- Payment is already verified using Stripe by the server. This transaction
-- prevents a process crash between changing booking state and queuing emails.
create function public.confirm_booking_with_outbox(p_kind text,p_booking_id text,p_session_id text,p_payment jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_session text; current_status text; current_payment text; expected numeric;
begin
  if p_kind='resource' then
    select stripe_session_id,status,payment_status,amount into strict current_session,current_status,current_payment,expected from public.bookings where id=p_booking_id for update;
  elsif p_kind='group' then
    select stripe_session_id,status,payment_status,amount into strict current_session,current_status,current_payment,expected from public.group_session_bookings where id=p_booking_id for update;
  else raise exception 'Invalid booking kind'; end if;
  if current_session is distinct from p_session_id or p_payment->>'currency' is distinct from 'gbp' or (p_payment->>'amount')::numeric is distinct from round(expected*100) then raise exception 'Payment mismatch'; end if;
  if current_status='confirmed' and current_payment='paid' then return false; end if;
  if current_status<>'pending_payment' then raise exception 'Booking not pending'; end if;
  if p_kind='resource' then
    update public.bookings set status='confirmed',payment_status='paid' where id=p_booking_id;
    insert into public.booking_notification_outbox(resource_booking_id,recipient_role,payment)
      values(p_booking_id,'customer',p_payment),(p_booking_id,'admin',p_payment);
  else
    update public.group_session_bookings set status='confirmed',payment_status='paid' where id=p_booking_id;
    insert into public.booking_notification_outbox(group_booking_id,recipient_role,payment) values(p_booking_id,'customer',p_payment);
  end if;
  update public.checkout_attempts set resolved=true where resource_booking_id=p_booking_id or group_booking_id=p_booking_id;
  return true;
end $$;

create function public.claim_booking_notifications(p_limit integer default 10)
returns setof public.booking_notification_outbox language plpgsql security invoker set search_path = '' as $$
begin
  -- Provider idempotency expires after 24h. Escalate uncertain older sends;
  -- never automatically risk a duplicate by issuing them outside that window.
  update public.booking_notification_outbox set state='attention'
    where state in ('pending','sending') and first_send_at < now()-interval '23 hours';
  return query update public.booking_notification_outbox o
    set state='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1
    where o.id in (select q.id from public.booking_notification_outbox q
      where q.state in ('pending','sending') and q.next_attempt_at<=now()
        and (q.lease_until is null or q.lease_until<now())
      order by q.next_attempt_at for update skip locked limit greatest(1,least(p_limit,20)))
    returning o.*;
end $$;
revoke all on function public.attach_checkout_attempt(text,text) from public,anon,authenticated;
revoke all on function public.confirm_booking_with_outbox(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.claim_booking_notifications(integer) from public,anon,authenticated;
grant execute on function public.attach_checkout_attempt(text,text) to service_role;
grant execute on function public.confirm_booking_with_outbox(text,text,text,jsonb) to service_role;
grant execute on function public.claim_booking_notifications(integer) to service_role;

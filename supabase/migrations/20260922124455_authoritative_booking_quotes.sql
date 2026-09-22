-- Additive, service-only quote/reservation layer. Review and test before applying.
create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  capability_hash text not null check (capability_hash ~ '^[a-f0-9]{64}$'),
  input jsonb not null,
  snapshot jsonb not null,
  configuration jsonb not null,
  amount_pence bigint not null check (amount_pence > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.booking_quotes enable row level security;
revoke all on public.booking_quotes from public, anon, authenticated;
grant select, insert, update, delete on public.booking_quotes to service_role;
alter table public.bookings add column if not exists quote_id uuid references public.booking_quotes(id);
alter table public.bookings add column if not exists pricing_resource_id text references public.resources(id);
alter table public.bookings add column if not exists buffer_mins integer not null default 0 check (buffer_mins between 0 and 1440);
create unique index if not exists bookings_quote_once on public.bookings(quote_id) where quote_id is not null;

-- Covers other service/admin insertion paths as well as the quote RPC. Existing
-- historical rows are neither converted nor rewritten by this migration.
create or replace function public.guard_booking_inventory()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.status not in ('confirmed','pending_payment') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(id, 9183))
    from (select distinct unnest(array[new.resource_id,new.pricing_resource_id]) as id) resources where id is not null order by id;
  if exists (select 1 from public.bookings b where b.id <> new.id and b.status in ('confirmed','pending_payment')
    and (b.resource_id in (new.resource_id,new.pricing_resource_id) or b.pricing_resource_id in (new.resource_id,new.pricing_resource_id))
    and new.start_at < b.end_at + make_interval(mins => greatest(new.buffer_mins,b.buffer_mins))
    and new.end_at + make_interval(mins => greatest(new.buffer_mins,b.buffer_mins)) > b.start_at)
  then raise exception using errcode = '23P01', message = 'Booking inventory conflict'; end if;
  return new;
end; $$;
revoke all on function public.guard_booking_inventory() from public, anon, authenticated;
grant execute on function public.guard_booking_inventory() to service_role;
create trigger booking_inventory_guard before insert or update of resource_id,pricing_resource_id,start_at,end_at,buffer_mins,status on public.bookings
for each row execute function public.guard_booking_inventory();

create or replace function public.reserve_booking_quote(p_quote_id uuid, p_capability_hash text, p_customer jsonb, p_payments boolean)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  q public.booking_quotes; existing public.bookings; created public.bookings;
  lane text; equipment text; starts timestamptz; ends timestamptz; gap integer;
begin
  select * into q from public.booking_quotes where id = p_quote_id and capability_hash = p_capability_hash for update;
  if not found then raise exception 'Quote unavailable'; end if;
  select * into existing from public.bookings where quote_id = q.id;
  if found then return to_jsonb(existing); end if;
  if q.expires_at <= now() then raise exception 'Quote expired'; end if;
  lane := q.snapshot->>'resourceId'; equipment := q.snapshot->>'pricingResourceId';
  starts := (q.snapshot->>'startAt')::timestamptz; ends := (q.snapshot->>'endAt')::timestamptz;
  gap := (q.snapshot->>'bufferMinutes')::integer;
  -- Serialise reservations sharing either the lane or service equipment.
  perform pg_advisory_xact_lock(hashtextextended(id, 9183)) from unnest(array[lane,equipment]) as resources(id) order by id;
  -- Admin configuration cannot change during the comparison/reservation transaction.
  lock table public.resources, public.resource_availability_rules, public.pricing_rules, public.slot_overrides, public.blocked_slots in share mode;
  if exists ((select * from public.resources) except (select * from jsonb_populate_recordset(null::public.resources, q.configuration->'resources')))
    or exists ((select * from jsonb_populate_recordset(null::public.resources, q.configuration->'resources')) except (select * from public.resources))
    or exists ((select * from public.resource_availability_rules) except (select * from jsonb_populate_recordset(null::public.resource_availability_rules, q.configuration->'resource_availability_rules')))
    or exists ((select * from jsonb_populate_recordset(null::public.resource_availability_rules, q.configuration->'resource_availability_rules')) except (select * from public.resource_availability_rules))
    or exists ((select * from public.pricing_rules) except (select * from jsonb_populate_recordset(null::public.pricing_rules, q.configuration->'pricing_rules')))
    or exists ((select * from jsonb_populate_recordset(null::public.pricing_rules, q.configuration->'pricing_rules')) except (select * from public.pricing_rules))
    or exists ((select * from public.slot_overrides) except (select * from jsonb_populate_recordset(null::public.slot_overrides, q.configuration->'slot_overrides')))
    or exists ((select * from jsonb_populate_recordset(null::public.slot_overrides, q.configuration->'slot_overrides')) except (select * from public.slot_overrides))
    or exists ((select * from public.blocked_slots) except (select * from jsonb_populate_recordset(null::public.blocked_slots, q.configuration->'blocked_slots')))
    or exists ((select * from jsonb_populate_recordset(null::public.blocked_slots, q.configuration->'blocked_slots')) except (select * from public.blocked_slots))
  then raise exception 'Configuration changed; review a fresh quote'; end if;
  if starts <= now() or ends <= starts then raise exception 'Invalid booking interval'; end if;
  if exists (select 1 from public.bookings b where b.status in ('confirmed','pending_payment')
    and (b.resource_id in (lane,equipment) or b.pricing_resource_id in (lane,equipment))
    and starts < b.end_at + make_interval(mins => greatest(gap,b.buffer_mins))
    and ends + make_interval(mins => greatest(gap,b.buffer_mins)) > b.start_at)
  then raise exception 'Time is unavailable'; end if;
  insert into public.bookings (quote_id,booking_reference,resource_id,pricing_resource_id,service_type,booking_date,start_at,end_at,buffer_mins,status,payment_status,amount,customer_name,customer_email,customer_phone,player_count,notes,expires_at)
  values (q.id,'CP-'||upper(replace(gen_random_uuid()::text,'-','')),lane,equipment,(q.input->>'serviceType')::public.service_type,
    (q.input->>'bookingDate')::date,starts,ends,gap,
    (case when p_payments then 'pending_payment' else 'confirmed' end)::public.booking_status,
    'pending',q.amount_pence::numeric/100,p_customer->>'name',p_customer->>'email',p_customer->>'phone',
    (p_customer->>'playerCount')::integer,p_customer->>'notes',now()+interval '31 minutes') returning * into created;
  return to_jsonb(created);
end; $$;
revoke all on function public.reserve_booking_quote(uuid,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.reserve_booking_quote(uuid,text,jsonb,boolean) to service_role;

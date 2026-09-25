-- A block is a single payment/reservation containing several ordinary lane bookings.
-- Individual rows remain in public.bookings so existing calendar/admin screens keep
-- their normal conflict and reporting behaviour.
create table public.block_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  player_count integer,
  notes text,
  amount numeric not null check (amount >= 0.30),
  status public.booking_status not null default 'pending_payment',
  payment_status text not null default 'pending',
  stripe_session_id text unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.block_bookings enable row level security;
revoke all on public.block_bookings from public, anon, authenticated;
grant all on public.block_bookings to service_role;

alter table public.bookings add column if not exists block_booking_id uuid references public.block_bookings(id);
create index if not exists bookings_block_booking_id_idx on public.bookings(block_booking_id) where block_booking_id is not null;

-- Customer-facing references are compact, readable and common to single and
-- block lane bookings. Ambiguous characters (I, O, 0 and 1) are excluded.
create function public.new_customer_booking_reference()
returns text language plpgsql volatile security invoker set search_path=public,extensions,pg_temp as $$
declare alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; candidate text; attempt integer; position integer;
begin
 for attempt in 1..20 loop
  bytes:=extensions.gen_random_bytes(6); candidate:='CCOE-';
  for position in 0..5 loop
   candidate:=candidate||substr(alphabet,(get_byte(bytes,position)%length(alphabet))+1,1);
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(candidate,7731));
  if not exists(select 1 from public.bookings where booking_reference=candidate)
   and not exists(select 1 from public.block_bookings where booking_reference=candidate) then return candidate; end if;
 end loop;
 raise exception 'Could not allocate booking reference';
end $$;

create function public.assign_customer_booking_reference()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.booking_reference is null or new.booking_reference ~ '^CPB?-' then
  new.booking_reference:=public.new_customer_booking_reference();
 end if;
 return new;
end $$;

create trigger bookings_short_reference before insert on public.bookings
for each row execute function public.assign_customer_booking_reference();
create trigger block_bookings_short_reference before insert on public.block_bookings
for each row execute function public.assign_customer_booking_reference();
revoke all on function public.new_customer_booking_reference(),public.assign_customer_booking_reference() from public,anon,authenticated;
grant execute on function public.new_customer_booking_reference(),public.assign_customer_booking_reference() to service_role;

create table public.block_booking_quotes (
  id uuid primary key default gen_random_uuid(),
  capability_hash text not null check (capability_hash ~ '^[a-f0-9]{64}$'),
  input jsonb not null,
  snapshot jsonb not null,
  configuration jsonb not null,
  amount_pence bigint not null check (amount_pence >= 30),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.block_booking_quotes enable row level security;
revoke all on public.block_booking_quotes from public, anon, authenticated;
grant all on public.block_booking_quotes to service_role;

alter table public.block_bookings add column quote_id uuid not null unique references public.block_booking_quotes(id);
alter table public.checkout_attempts add column block_booking_id uuid unique references public.block_bookings(id);
alter table public.checkout_attempts drop constraint checkout_attempts_check;
alter table public.checkout_attempts add constraint checkout_attempts_check check (num_nonnulls(resource_booking_id,group_booking_id,block_booking_id)=1);

-- Reuse the single-session pricing/configuration and inventory safeguards inside
-- ONE transaction. A conflict on the last date rolls back the whole block.
create function public.reserve_block_booking(p_quote_id uuid,p_capability_hash text,p_customer jsonb,p_app_url text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.block_booking_quotes; b public.block_bookings; occurrence jsonb; child jsonb; child_quote uuid; total bigint; count_dates integer;
begin
 select * into strict q from public.block_booking_quotes where id=p_quote_id and capability_hash=p_capability_hash for update;
 select * into b from public.block_bookings where quote_id=q.id;
 if found then return to_jsonb(b); end if;
 if q.expires_at<=now() then raise exception 'Block quote expired'; end if;
 select sum((x->>'amountPence')::bigint),count(*) into total,count_dates from jsonb_array_elements(q.snapshot->'occurrences') x;
 if count_dates not between 1 and 125 or total is distinct from q.amount_pence then raise exception 'Invalid block total'; end if;
 -- Stable lock ordering also protects future blocks spanning multiple resources.
 perform pg_advisory_xact_lock(hashtextextended(id,9183)) from
  (select distinct x->>'resourceId' id from jsonb_array_elements(q.snapshot->'occurrences') x) lanes order by id;
 insert into public.block_bookings(quote_id,booking_reference,customer_name,customer_email,customer_phone,player_count,notes,amount,expires_at)
 values(q.id,'CPB-'||upper(replace(gen_random_uuid()::text,'-','')),p_customer->>'name',p_customer->>'email',p_customer->>'phone',(p_customer->>'playerCount')::integer,p_customer->>'notes',total::numeric/100,now()+interval '31 minutes') returning * into b;
 for occurrence in select value from jsonb_array_elements(q.snapshot->'occurrences') loop
  if occurrence->>'resourceId' is distinct from q.input->>'resourceId' or occurrence->>'pricingResourceId' is distinct from q.input->>'resourceId' then raise exception 'Block requires one lane'; end if;
  insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
  values(q.capability_hash,jsonb_build_object('serviceType','lane_hire','bookingDate',occurrence->>'bookingDate'),occurrence,q.configuration,(occurrence->>'amountPence')::bigint,q.expires_at) returning id into child_quote;
  child:=public.reserve_booking_quote(child_quote,q.capability_hash,p_customer,true);
  update public.bookings set block_booking_id=b.id,expires_at=b.expires_at where id=child->>'id';
 end loop;
 -- Persist before any provider call, including crashes between reservation and checkout.
 insert into public.checkout_attempts(id,block_booking_id,params) values('block:'||b.id,b.id,jsonb_build_object(
  'bookingId',b.id,'bookingReference',b.booking_reference,'bookingKind','block','serviceType','lane_hire','amount',b.amount::text,
  'customerEmail',b.customer_email,'customerName',b.customer_name,'description','Lane hire block - '||count_dates||' sessions',
  'expiresAt',floor(extract(epoch from b.expires_at)),'appUrl',p_app_url));
 return to_jsonb(b);
end $$;

create function public.attach_block_checkout(p_attempt_id text,p_session_id text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.checkout_attempts; b public.block_bookings;
begin
 select * into strict a from public.checkout_attempts where id=p_attempt_id for update;
 select * into strict b from public.block_bookings where id=a.block_booking_id for update;
 if b.status not in ('pending_payment','confirmed') or
  (a.stripe_session_id is not null and a.stripe_session_id<>p_session_id) or
  (b.stripe_session_id is not null and b.stripe_session_id<>p_session_id) then raise exception 'Invalid block checkout state'; end if;
 update public.block_bookings set stripe_session_id=p_session_id where id=b.id;
 update public.checkout_attempts set stripe_session_id=p_session_id where id=a.id;
end $$;

create function public.confirm_block_booking(p_booking_id uuid,p_session_id text,p_payment jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.block_bookings; child public.bookings; notification_booking_id uuid;
begin
 -- Match attach lock ordering to avoid webhook/reconciliation deadlocks.
 perform 1 from public.checkout_attempts where block_booking_id=p_booking_id for update;
 select * into strict b from public.block_bookings where id=p_booking_id for update;
 if b.stripe_session_id is distinct from p_session_id or p_payment->>'currency' is distinct from 'gbp' or (p_payment->>'amount')::numeric is distinct from round(b.amount*100) then raise exception 'Block payment mismatch'; end if;
 if b.status='confirmed' and b.payment_status='paid' then return false; end if;
 if b.status<>'pending_payment' then raise exception 'Block not pending'; end if;
 if exists(select 1 from public.bookings where block_booking_id=b.id and status<>'pending_payment') or
  (select sum(amount) from public.bookings where block_booking_id=b.id) is distinct from b.amount then raise exception 'Block inventory mismatch'; end if;
 for child in select * from public.bookings where block_booking_id=b.id order by start_at for update loop
  update public.bookings set status='confirmed',payment_status='paid' where id=child.id;
  notification_booking_id:=coalesce(notification_booking_id,child.id);
 end loop;
 if notification_booking_id is null then raise exception 'Block inventory missing'; end if;
 -- One customer summary and one admin summary cover the complete block.
 insert into public.booking_notification_outbox(resource_booking_id,recipient_role,payment)
 values(notification_booking_id,'customer',p_payment),
       (notification_booking_id,'admin',p_payment);
 update public.block_bookings set status='confirmed',payment_status='paid' where id=b.id;
 update public.checkout_attempts set resolved=true where block_booking_id=b.id;
 return true;
end $$;

create function public.claim_block_booking_notifications(p_block_booking_id uuid,p_limit integer default 2)
returns setof public.booking_notification_outbox language plpgsql security invoker set search_path='' as $$
begin
 return query update public.booking_notification_outbox o
 set state='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1
 where o.id in (
  select q.id from public.booking_notification_outbox q
  join public.bookings child on child.id=q.resource_booking_id
  where child.block_booking_id=p_block_booking_id and q.state in ('pending','sending')
    and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
  order by q.next_attempt_at for update of q skip locked limit greatest(1,least(p_limit,2))
 ) returning o.*;
end $$;

create function public.expire_block_booking(p_booking_id uuid,p_session_id text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.block_bookings;
begin
 perform 1 from public.checkout_attempts where block_booking_id=p_booking_id for update;
 select * into strict b from public.block_bookings where id=p_booking_id for update;
 if b.stripe_session_id is distinct from p_session_id then raise exception 'Block session mismatch'; end if;
 if b.status<>'pending_payment' then return; end if;
 update public.bookings set status='cancelled',payment_status='failed' where block_booking_id=b.id and status='pending_payment';
 update public.block_bookings set status='cancelled',payment_status='failed' where id=b.id;
 update public.checkout_attempts set resolved=true where block_booking_id=b.id;
end $$;

revoke all on function public.reserve_block_booking(uuid,text,jsonb,text),public.attach_block_checkout(text,text),public.confirm_block_booking(uuid,text,jsonb),public.expire_block_booking(uuid,text),public.claim_block_booking_notifications(uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_block_booking(uuid,text,jsonb,text),public.attach_block_checkout(text,text),public.confirm_block_booking(uuid,text,jsonb),public.expire_block_booking(uuid,text),public.claim_block_booking_notifications(uuid,integer) to service_role;

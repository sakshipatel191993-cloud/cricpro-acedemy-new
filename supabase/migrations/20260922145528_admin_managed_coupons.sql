-- Application-owned percentage discounts. All paid services share one customer cap.
-- No campaign is activated or seeded by this additive migration.
create table public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
 percent_off integer not null check(percent_off between 1 and 99), max_uses integer not null check(max_uses between 1 and 100000),
 starts_at timestamptz not null, expires_at timestamptz not null check(expires_at > starts_at),
 status text not null default 'draft' check(status in ('draft','active','disabled','archived')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
 resource_booking_id text unique references public.bookings(id), group_booking_id text unique references public.group_session_bookings(id),
 email_key text not null check(email_key ~ '^[a-f0-9]{64}$'), owner_id uuid references auth.users(id),
 state text not null default 'reserved' check(state in ('reserved','redeemed','released')),
 snapshot jsonb not null, created_at timestamptz not null default now(), settled_at timestamptz,
 check(num_nonnulls(resource_booking_id,group_booking_id)=1)
);
create index coupon_capacity on public.coupon_redemptions(coupon_id,state);
create index coupon_email_usage on public.coupon_redemptions(email_key) where state <> 'released';
create index coupon_owner_usage on public.coupon_redemptions(owner_id) where state <> 'released';
create table public.coupon_audit (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
 action text not null, snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_audit enable row level security;
revoke all on public.coupons,public.coupon_redemptions,public.coupon_audit from public,anon,authenticated;
grant select,insert,update on public.coupons,public.coupon_redemptions,public.coupon_audit to service_role;
alter table public.bookings add column coupon_snapshot jsonb;
alter table public.group_session_bookings add column coupon_snapshot jsonb;

create function public.admin_coupon_list() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object(
 'reserved',(select count(*) from public.coupon_redemptions r where r.coupon_id=c.id and r.state='reserved'),
 'redeemed',(select count(*) from public.coupon_redemptions r where r.coupon_id=c.id and r.state='redeemed')) order by c.created_at desc),'[]'::jsonb)
 from public.coupons c;
$$;
create function public.admin_save_coupon(p_action text,p_id uuid,p_version integer,p_input jsonb)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.coupons; used integer;
begin
 if p_action='create' then
  insert into public.coupons(code,percent_off,max_uses,starts_at,expires_at,status)
   values(p_input->>'code',(p_input->>'percent_off')::integer,(p_input->>'max_uses')::integer,(p_input->>'starts_at')::timestamptz,(p_input->>'expires_at')::timestamptz,p_input->>'status') returning * into c;
 else
  select * into strict c from public.coupons where id=p_id for update;
  if c.version is distinct from p_version or c.status='archived' then raise exception 'Coupon changed or archived'; end if;
  if p_action='archive' then
   update public.coupons set status='archived',version=version+1,updated_at=now() where id=p_id returning * into c;
  elsif p_action='update' then
   if c.code is distinct from p_input->>'code' then raise exception 'Code cannot be renamed'; end if;
   select count(*) into used from public.coupon_redemptions where coupon_id=p_id and state <> 'released';
   if (p_input->>'max_uses')::integer < used then raise exception 'Cap below committed usage'; end if;
   update public.coupons set percent_off=(p_input->>'percent_off')::integer,max_uses=(p_input->>'max_uses')::integer,
    starts_at=(p_input->>'starts_at')::timestamptz,expires_at=(p_input->>'expires_at')::timestamptz,status=p_input->>'status',version=version+1,updated_at=now()
    where id=p_id returning * into c;
  else raise exception 'Invalid action'; end if;
 end if;
 insert into public.coupon_audit(coupon_id,action,snapshot) values(c.id,p_action,to_jsonb(c));
 return to_jsonb(c);
end $$;

-- Caller already owns and locks the new booking. Always called inside the same
-- transaction as inventory reservation; coupon failures roll back the hold.
create function public.apply_booking_coupon(p_kind text,p_id text,p_code text,p_version integer,p_email_key text,p_owner uuid)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare b jsonb; c public.coupons; s jsonb; subtotal bigint; reduction bigint:=0;
begin
 if p_kind='resource' then select to_jsonb(x) into strict b from public.bookings x where id=p_id for update;
 elsif p_kind='group' then select to_jsonb(x) into strict b from public.group_session_bookings x where id=p_id for update;
 else raise exception 'Invalid kind'; end if;
 if b->'coupon_snapshot' is not null and b->'coupon_snapshot' <> 'null'::jsonb then
  if b->'coupon_snapshot'->>'code' is distinct from p_code then raise exception 'Coupon cannot change on an existing checkout'; end if;
  return b;
 end if;
 if exists(select 1 from public.checkout_attempts where resource_booking_id=p_id or group_booking_id=p_id) or b->>'status' <> 'pending_payment' then raise exception 'Checkout already started'; end if;
 subtotal:=round((b->>'amount')::numeric*100);
 if p_code is not null then
  -- One customer across ALL codes and booking families. Fixed campaign lock
  -- serialises these small-volume checks, including code-to-code races.
  perform pg_advisory_xact_lock(7728,478115);
  select * into strict c from public.coupons where code=p_code for update;
  if c.version is distinct from p_version or c.status<>'active' or now()<c.starts_at or now()>=c.expires_at then raise exception 'Coupon unavailable'; end if;
  if p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$' then raise exception 'Customer key required'; end if;
  if exists(select 1 from public.coupon_redemptions where state<>'released' and (email_key=p_email_key or (p_owner is not null and owner_id=p_owner))) then raise exception 'Coupon unavailable'; end if;
  if (select count(*) from public.coupon_redemptions where coupon_id=c.id and state<>'released') >= c.max_uses then raise exception 'Coupon unavailable'; end if;
  reduction:=round(subtotal*c.percent_off::numeric/100);
 end if;
 if subtotal-reduction < 30 or subtotal > 99999999 then raise exception 'Invalid payable amount'; end if;
 s:=jsonb_build_object('code',p_code,'couponId',c.id,'version',c.version,'percent',coalesce(c.percent_off,0),'subtotalMinor',subtotal,'discountMinor',reduction,'totalMinor',subtotal-reduction,'currency','gbp');
 if p_kind='resource' then
  update public.bookings set amount=(subtotal-reduction)::numeric/100,coupon_snapshot=s where id=p_id returning to_jsonb(bookings.*) into b;
 else
  update public.group_session_bookings set amount=(subtotal-reduction)::numeric/100,coupon_snapshot=s where id=p_id returning to_jsonb(group_session_bookings.*) into b;
 end if;
 if p_code is not null then insert into public.coupon_redemptions(coupon_id,resource_booking_id,group_booking_id,email_key,owner_id,snapshot)
  values(c.id,case when p_kind='resource' then p_id end,case when p_kind='group' then p_id end,p_email_key,p_owner,s); end if;
 return b;
end $$;

create function public.reserve_quote_with_coupon(p_quote_id uuid,p_capability_hash text,p_customer jsonb,p_payments boolean,p_code text,p_version integer,p_email_key text,p_owner uuid)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare b jsonb;
begin
 b:=public.reserve_booking_quote(p_quote_id,p_capability_hash,p_customer,p_payments);
 return public.apply_booking_coupon('resource',b->>'id',p_code,p_version,p_email_key,p_owner);
end $$;
alter table public.group_session_bookings add column if not exists whatsapp_consent jsonb;
create function public.reserve_group_with_coupon(p_booking jsonb,p_code text,p_version integer,p_email_key text,p_owner uuid)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.group_session_bookings; existing public.group_session_bookings;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_booking->>'id',4215));
 select * into existing from public.group_session_bookings where id=p_booking->>'id' for update;
 if found then
  if existing.request_hash is distinct from p_booking->>'request_hash' then raise exception 'Booking details changed'; end if;
 else
  b:=jsonb_populate_record(null::public.group_session_bookings,p_booking);
  insert into public.group_session_bookings(id,session_id,player_name,player_age,parent_name,parent_email,parent_phone,emergency_contact,medical_notes,skill_level,status,payment_status,amount,expires_at,request_hash,checkout_description,checkout_service_type,whatsapp_consent)
   values(b.id,b.session_id,b.player_name,b.player_age,b.parent_name,b.parent_email,b.parent_phone,b.emergency_contact,b.medical_notes,b.skill_level,b.status,b.payment_status,b.amount,b.expires_at,b.request_hash,b.checkout_description,b.checkout_service_type,b.whatsapp_consent);
 end if;
 return public.apply_booking_coupon('group',p_booking->>'id',p_code,p_version,p_email_key,p_owner);
end $$;

-- The paid transition is already an authenticated verified-payment transaction.
create function public.settle_coupon_payment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.payment_status='paid' and old.payment_status is distinct from 'paid' then
  update public.coupon_redemptions set state='redeemed',settled_at=now() where state='reserved' and
   ((TG_TABLE_NAME='bookings' and resource_booking_id=new.id) or (TG_TABLE_NAME='group_session_bookings' and group_booking_id=new.id));
 elsif new.payment_status='failed' and old.payment_status='pending' and new.stripe_session_id is not null and new.status::text in ('cancelled','expired') then
  -- Existing signed webhook/reconciliation paths verify the exact current
  -- terminal Stripe session before making this transition. No timer releases.
  update public.coupon_redemptions set state='released' where state='reserved' and
   ((TG_TABLE_NAME='bookings' and resource_booking_id=new.id) or (TG_TABLE_NAME='group_session_bookings' and group_booking_id=new.id));
 end if;
 return new;
end $$;
create trigger settle_resource_coupon after update of payment_status on public.bookings for each row execute function public.settle_coupon_payment();
create trigger settle_group_coupon after update of payment_status on public.group_session_bookings for each row execute function public.settle_coupon_payment();

-- Called only after provider-verified terminal expiry, never from a browser timer.
create function public.release_checkout_coupon(p_kind text,p_id text,p_session text) returns void language plpgsql security invoker set search_path='' as $$
declare b jsonb;
begin
 if p_kind='resource' then select to_jsonb(x) into b from public.bookings x where id=p_id for update;
 elsif p_kind='group' then select to_jsonb(x) into b from public.group_session_bookings x where id=p_id for update;
 else raise exception 'Invalid kind'; end if;
 if b->>'stripe_session_id'=p_session and b->>'payment_status'='failed' and b->>'status' in ('cancelled','expired') then
  update public.coupon_redemptions set state='released' where state='reserved' and ((p_kind='resource' and resource_booking_id=p_id) or (p_kind='group' and group_booking_id=p_id));
 end if;
end $$;
revoke all on function public.admin_coupon_list(),public.admin_save_coupon(text,uuid,integer,jsonb),public.apply_booking_coupon(text,text,text,integer,text,uuid),public.reserve_quote_with_coupon(uuid,text,jsonb,boolean,text,integer,text,uuid),public.reserve_group_with_coupon(jsonb,text,integer,text,uuid),public.settle_coupon_payment(),public.release_checkout_coupon(text,text,text) from public,anon,authenticated;
grant execute on function public.admin_coupon_list(),public.admin_save_coupon(text,uuid,integer,jsonb),public.apply_booking_coupon(text,text,text,integer,text,uuid),public.reserve_quote_with_coupon(uuid,text,jsonb,boolean,text,integer,text,uuid),public.reserve_group_with_coupon(jsonb,text,integer,text,uuid),public.settle_coupon_payment(),public.release_checkout_coupon(text,text,text) to service_role;

-- Fixed, lane-hire-only coupons. Existing historic snapshots are immutable.
alter table public.coupons
  add column fixed_discount_minor integer not null default 0 check (fixed_discount_minor >= 0),
  add column minimum_subtotal_minor integer not null default 2500 check (minimum_subtotal_minor >= 30),
  add column applies_to_service_type text not null default 'lane_hire' check (applies_to_service_type = 'lane_hire');

update public.coupons
set fixed_discount_minor = case code
  when 'COACH15' then 1000
  when 'COACH20' then 500
  when 'CLUBDISCOUNT' then 250
  else fixed_discount_minor
end,
minimum_subtotal_minor = 2500,
applies_to_service_type = 'lane_hire';

insert into public.coupons(code,percent_off,fixed_discount_minor,minimum_subtotal_minor,applies_to_service_type,max_uses,starts_at,expires_at,status)
select 'CLUBDISCOUNT',1,250,2500,'lane_hire',max_uses,starts_at,expires_at,status
from public.coupons where code='COACH15'
on conflict (code) do update set fixed_discount_minor=excluded.fixed_discount_minor,
 minimum_subtotal_minor=excluded.minimum_subtotal_minor,applies_to_service_type=excluded.applies_to_service_type,updated_at=now();

create or replace function public.admin_save_coupon(p_action text,p_id uuid,p_version integer,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.coupons; used integer;
begin
 if p_action='create' then
  insert into public.coupons(code,percent_off,fixed_discount_minor,minimum_subtotal_minor,applies_to_service_type,max_uses,starts_at,expires_at,status)
   values(p_input->>'code',1,(p_input->>'fixed_discount_minor')::integer,2500,'lane_hire',(p_input->>'max_uses')::integer,(p_input->>'starts_at')::timestamptz,(p_input->>'expires_at')::timestamptz,p_input->>'status') returning * into c;
 else
  select * into strict c from public.coupons where id=p_id for update;
  if c.version is distinct from p_version or c.status='archived' then raise exception 'Coupon changed or archived'; end if;
  if p_action='archive' then
   update public.coupons set status='archived',version=version+1,updated_at=now() where id=p_id returning * into c;
  elsif p_action='update' then
   if c.code is distinct from p_input->>'code' then raise exception 'Code cannot be renamed'; end if;
   select count(*) into used from public.coupon_redemptions where coupon_id=p_id and state <> 'released';
   if (p_input->>'max_uses')::integer < used then raise exception 'Cap below committed usage'; end if;
   update public.coupons set fixed_discount_minor=(p_input->>'fixed_discount_minor')::integer,minimum_subtotal_minor=2500,applies_to_service_type='lane_hire',max_uses=(p_input->>'max_uses')::integer,
    starts_at=(p_input->>'starts_at')::timestamptz,expires_at=(p_input->>'expires_at')::timestamptz,status=p_input->>'status',version=version+1,updated_at=now()
    where id=p_id returning * into c;
  else raise exception 'Invalid action'; end if;
 end if;
 if c.fixed_discount_minor < 1 then raise exception 'Invalid fixed discount'; end if;
 insert into public.coupon_audit(coupon_id,action,snapshot) values(c.id,p_action,to_jsonb(c));
 return to_jsonb(c);
end $$;

create or replace function public.apply_booking_coupon(p_kind text,p_id text,p_code text,p_version integer,p_email_key text,p_owner uuid)
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
  if p_kind <> 'resource' or b->>'service_type' <> 'lane_hire' then raise exception 'Coupons apply to lane hire only'; end if;
  perform pg_advisory_xact_lock(7728,478115);
  select * into strict c from public.coupons where code=p_code for update;
  if c.version is distinct from p_version or c.status<>'active' or now()<c.starts_at or now()>=c.expires_at or c.applies_to_service_type <> 'lane_hire' then raise exception 'Coupon unavailable'; end if;
  if subtotal < c.minimum_subtotal_minor then raise exception 'Coupon requires a £25 lane hire total'; end if;
  if p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$' then raise exception 'Customer key required'; end if;
  if exists(select 1 from public.coupon_redemptions where state<>'released' and (email_key=p_email_key or (p_owner is not null and owner_id=p_owner))) then raise exception 'Coupon unavailable'; end if;
  if (select count(*) from public.coupon_redemptions where coupon_id=c.id and state<>'released') >= c.max_uses then raise exception 'Coupon unavailable'; end if;
  reduction:=c.fixed_discount_minor;
 end if;
 if subtotal-reduction < 30 or subtotal > 99999999 then raise exception 'Invalid payable amount'; end if;
 s:=jsonb_build_object('code',p_code,'couponId',c.id,'version',c.version,'percent',0,'fixedDiscountMinor',coalesce(c.fixed_discount_minor,0),'minimumSubtotalMinor',coalesce(c.minimum_subtotal_minor,0),'subtotalMinor',subtotal,'discountMinor',reduction,'totalMinor',subtotal-reduction,'currency','gbp');
 if p_kind='resource' then
  update public.bookings set amount=(subtotal-reduction)::numeric/100,coupon_snapshot=s where id=p_id returning to_jsonb(bookings.*) into b;
 else
  update public.group_session_bookings set amount=(subtotal-reduction)::numeric/100,coupon_snapshot=s where id=p_id returning to_jsonb(group_session_bookings.*) into b;
 end if;
 if p_code is not null then insert into public.coupon_redemptions(coupon_id,resource_booking_id,group_booking_id,email_key,owner_id,snapshot)
  values(c.id,case when p_kind='resource' then p_id end,case when p_kind='group' then p_id end,p_email_key,p_owner,s); end if;
 return b;
end $$;

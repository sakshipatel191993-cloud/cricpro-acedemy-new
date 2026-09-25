-- Give group sessions and masterclasses the same CCOE-XXXXXX customer
-- reference used by single and block lane bookings. Keep each existing id as
-- the stable internal key for Stripe, checkout retries and booking access.
alter table public.group_session_bookings
  add column booking_reference text;

create or replace function public.new_customer_booking_reference()
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
   and not exists(select 1 from public.block_bookings where booking_reference=candidate)
   and not exists(select 1 from public.group_session_bookings where booking_reference=candidate) then return candidate; end if;
 end loop;
 raise exception 'Could not allocate booking reference';
end $$;

create function public.assign_group_customer_booking_reference()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 new.booking_reference:=public.new_customer_booking_reference();
 return new;
end $$;

create trigger group_session_bookings_short_reference before insert on public.group_session_bookings
for each row execute function public.assign_group_customer_booking_reference();

-- Backfill historical rows without changing their internal ids or old links.
do $$
declare row_id text;
begin
 for row_id in select id from public.group_session_bookings where booking_reference is null loop
  update public.group_session_bookings
  set booking_reference=public.new_customer_booking_reference()
  where id=row_id;
 end loop;
end $$;

alter table public.group_session_bookings
  alter column booking_reference set not null;
alter table public.group_session_bookings
  add constraint group_session_bookings_booking_reference_key unique (booking_reference);

revoke all on function public.assign_group_customer_booking_reference() from public,anon,authenticated;
grant execute on function public.assign_group_customer_booking_reference() to service_role;

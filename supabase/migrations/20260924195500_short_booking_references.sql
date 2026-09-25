-- Future single and block lane bookings use CCOE-XXXXXX customer references.
-- Existing references stay unchanged so paid checkout links and past emails
-- remain valid.
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

drop trigger if exists bookings_short_reference on public.bookings;
create trigger bookings_short_reference before insert on public.bookings
for each row execute function public.assign_customer_booking_reference();
drop trigger if exists block_bookings_short_reference on public.block_bookings;
create trigger block_bookings_short_reference before insert on public.block_bookings
for each row execute function public.assign_customer_booking_reference();

revoke all on function public.new_customer_booking_reference(),public.assign_customer_booking_reference() from public,anon,authenticated;
grant execute on function public.new_customer_booking_reference(),public.assign_customer_booking_reference() to service_role;

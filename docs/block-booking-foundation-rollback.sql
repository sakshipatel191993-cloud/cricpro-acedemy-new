-- Emergency rollback for 20260924133000_block_booking_foundation.sql.
-- This removes block checkout data and restores checkout_attempts to the
-- pre-block constraint. Run only if the block-booking migration must be undone.
begin;

drop function if exists public.expire_block_booking(uuid,text);
drop function if exists public.confirm_block_booking(uuid,text,jsonb);
drop function if exists public.attach_block_checkout(text,text);
drop function if exists public.reserve_block_booking(uuid,text,jsonb,text);

delete from public.checkout_attempts where block_booking_id is not null;
delete from public.bookings where block_booking_id is not null;

alter table public.checkout_attempts drop constraint if exists checkout_attempts_check;
alter table public.checkout_attempts drop column if exists block_booking_id;
alter table public.checkout_attempts add constraint checkout_attempts_check
  check (num_nonnulls(resource_booking_id,group_booking_id)=1);

drop index if exists public.bookings_block_booking_id_idx;
alter table public.bookings drop column if exists block_booking_id;
drop table if exists public.block_bookings;
drop table if exists public.block_booking_quotes;

commit;

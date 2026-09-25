-- The four physical lanes are the single source of bookable availability for
-- lane hire, side-arm sessions, bowling-machine sessions and block bookings.
-- Existing service-level rows are retained for quote audit compatibility, but
-- application code ignores them and this guard prevents further drift.

create or replace function public.require_lane_availability_resource()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.resources
    where id = new.resource_id
      and type = 'lane'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Availability rules can only be assigned to physical lanes';
  end if;
  return new;
end;
$$;

revoke all on function public.require_lane_availability_resource() from public, anon, authenticated;
grant execute on function public.require_lane_availability_resource() to service_role;

drop trigger if exists resource_availability_lane_only on public.resource_availability_rules;
create trigger resource_availability_lane_only
before insert or update on public.resource_availability_rules
for each row execute function public.require_lane_availability_resource();

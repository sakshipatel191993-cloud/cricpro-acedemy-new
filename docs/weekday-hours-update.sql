-- Approved operational data update. Preserve prices, exceptions, blocked slots
-- and existing bookings. Weekdays 9-22; weekends 9-23, off-peak until 11.
begin;
update public.resource_availability_rules
set start_time = '09:00', end_time = '22:00'
where active and day_of_week between 1 and 5
  and start_time = '12:00' and end_time = '23:00';

update public.resource_availability_rules
set end_time = '23:00'
where active and day_of_week in (0,6)
  and start_time = '09:00' and end_time = '22:00';

-- Cover the newly opened morning hours at each resource's existing off-peak
-- rate. Keep the original noon/weekend pricing rules untouched.
insert into public.pricing_rules
  (id, resource_id, name, start_time, end_time, days, price, priority, active)
select 'weekday-morning-' || id, resource_id, 'Weekday Morning Off Peak (9am-12pm)',
  '09:00'::time, '12:00'::time, array[1,2,3,4,5], price, priority, true
from public.pricing_rules
where active and start_time = '12:00' and end_time = '16:00'
  and days @> array[1,2,3,4,5]
on conflict (id) do nothing;

-- Copy each resource's established prices into explicit weekend windows.
insert into public.pricing_rules
  (id, resource_id, name, start_time, end_time, days, price, priority, active)
select 'weekend-morning-' || id, resource_id, 'Weekend Off Peak (9am-11am)',
  '09:00'::time, '11:00'::time, array[0,6], price, priority, true
from public.pricing_rules
where active and start_time = '12:00' and end_time = '16:00'
  and days @> array[1,2,3,4,5]
on conflict (id) do nothing;

insert into public.pricing_rules
  (id, resource_id, name, start_time, end_time, days, price, priority, active)
select 'weekend-peak-' || id, resource_id, 'Weekend Peak (11am-11pm)',
  '11:00'::time, '23:00'::time, array[0,6], price, priority, true
from public.pricing_rules
where active and start_time = '16:00' and end_time = '22:00'
  and days @> array[1,2,3,4,5]
on conflict (id) do nothing;

-- Old overlapping all-day/weekend rules must not win ahead of the new bands.
update public.pricing_rules
set days = array_remove(array_remove(days,0),6),
    active = cardinality(array_remove(array_remove(days,0),6)) > 0
where active and (0 = any(days) or 6 = any(days))
  and id not like 'weekend-morning-%' and id not like 'weekend-peak-%';
commit;

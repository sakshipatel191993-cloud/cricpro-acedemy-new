-- Supersedes weekday-hours-update.sql following the latest owner instruction.
-- Mon-Fri 15:00-23:00, off-peak 15:00-17:00, peak 17:00-23:00.
-- Weekend hours/prices, exceptions and existing bookings remain unchanged.
begin;
update public.resource_availability_rules
set start_time = '15:00', end_time = '23:00'
where active and day_of_week between 1 and 5
  and start_time = '09:00' and end_time = '22:00';

update public.pricing_rules
set start_time = '15:00', end_time = '17:00', name = 'Weekday Off-Peak (3pm-5pm)'
where active and days = array[1,2,3,4,5]
  and start_time = '12:00' and end_time = '16:00';

update public.pricing_rules
set start_time = '17:00', end_time = '23:00', name = 'Weekday Peak (5pm-11pm)'
where active and days = array[1,2,3,4,5]
  and start_time = '16:00' and end_time = '22:00';

-- Retain superseded rules for audit/recovery, but remove their applicability.
update public.pricing_rules set active = false
where active and days = array[1,2,3,4,5]
  and ((id like 'weekday-morning-peak-%' and start_time = '09:00' and end_time = '12:00')
    or (start_time = '22:00' and end_time = '24:00'));
commit;

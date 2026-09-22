\set ON_ERROR_STOP on
begin;
insert into public.resources(id,name,type) values('recovery-test-resource','Synthetic lane','lane');
insert into public.bookings(id,booking_reference,resource_id,service_type,booking_date,start_at,end_at,amount,customer_name,customer_email)
values('recovery-test-booking','RECOVERY-TEST','recovery-test-resource','lane_hire','2035-01-01','2035-01-01T15:00:00Z','2035-01-01T16:00:00Z',25,'Synthetic','synthetic@example.invalid');
insert into public.checkout_attempts(id,resource_booking_id,params) values('resource:recovery-test-booking','recovery-test-booking','{}');
select public.attach_checkout_attempt('resource:recovery-test-booking','cs_synthetic');
do $$
begin
  if (select stripe_session_id from public.bookings where id='recovery-test-booking')<>'cs_synthetic' then raise exception 'Session not attached'; end if;
  begin
    perform public.attach_checkout_attempt('resource:recovery-test-booking','cs_other');
    raise exception 'Conflicting session accepted';
  exception when raise_exception then
    if sqlerrm='Conflicting session accepted' then raise; end if;
  end;
  begin
    perform public.confirm_booking_with_outbox('resource','recovery-test-booking','cs_synthetic','{"amount":1,"currency":"gbp"}');
    raise exception 'Wrong amount accepted';
  exception when raise_exception then
    if sqlerrm='Wrong amount accepted' then raise; end if;
  end;
  if (select status from public.bookings where id='recovery-test-booking')<>'pending_payment' then raise exception 'Failed validation mutated booking'; end if;
end $$;

-- Simulate failure after state change but before outbox commit: everything rolls back.
create function public.synthetic_outbox_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic outbox failure'; end $$;
create trigger synthetic_outbox_failure before insert on public.booking_notification_outbox for each row execute function public.synthetic_outbox_failure();
do $$ begin
  begin
    perform public.confirm_booking_with_outbox('resource','recovery-test-booking','cs_synthetic','{"amount":2500,"currency":"gbp"}');
  exception when raise_exception then
    if sqlerrm<>'Synthetic outbox failure' then raise; end if;
  end;
  if (select status from public.bookings where id='recovery-test-booking')<>'pending_payment' then raise exception 'State committed without outbox'; end if;
end $$;
drop trigger synthetic_outbox_failure on public.booking_notification_outbox;
drop function public.synthetic_outbox_failure();
do $$ declare first_count integer; next_count integer;
begin
  if not public.confirm_booking_with_outbox('resource','recovery-test-booking','cs_synthetic','{"amount":2500,"currency":"gbp"}') then raise exception 'Not confirmed'; end if;
  if public.confirm_booking_with_outbox('resource','recovery-test-booking','cs_synthetic','{"amount":2500,"currency":"gbp"}') then raise exception 'Replay confirmed twice'; end if;
  if (select count(*) from public.booking_notification_outbox where resource_booking_id='recovery-test-booking')<>2 then raise exception 'Expected customer/admin jobs exactly once'; end if;
  select count(*) into first_count from public.claim_booking_notifications(20);
  select count(*) into next_count from public.claim_booking_notifications(20);
  if first_count<>2 or next_count<>0 then raise exception 'Leased jobs claimed twice'; end if;
  if has_table_privilege('anon','public.checkout_attempts','SELECT') or has_table_privilege('authenticated','public.booking_notification_outbox','SELECT') then raise exception 'Browser can read private payment work'; end if;
  if has_function_privilege('anon','public.confirm_booking_with_outbox(text,text,text,jsonb)','EXECUTE') then raise exception 'Browser can fulfil'; end if;
  if not has_function_privilege('service_role','public.confirm_booking_with_outbox(text,text,text,jsonb)','EXECUTE') then raise exception 'Service role cannot fulfil'; end if;
end $$;
insert into public.group_sessions(id,title,age_group,max_players,schedule,price) values('recovery-test-group','Synthetic','11-15 years',10,'Synthetic',40);
insert into public.group_session_bookings(id,session_id,player_name,parent_name,parent_email,parent_phone,status,payment_status,amount,stripe_session_id)
values('recovery-test-group-booking','recovery-test-group','Synthetic','Synthetic','synthetic@example.invalid','000','pending_payment','pending',40,'cs_group_synthetic');
do $$ begin
  if not public.confirm_booking_with_outbox('group','recovery-test-group-booking','cs_group_synthetic','{"amount":4000,"currency":"gbp"}') then raise exception 'Group not confirmed'; end if;
  if (select count(*) from public.booking_notification_outbox where group_booking_id='recovery-test-group-booking')<>1 then raise exception 'Group notification missing'; end if;
end $$;
rollback;
\echo PASS: payment attachment guards, money checks, atomic outbox rollback, duplicate fulfilment, lease claims, role privileges and group fulfilment

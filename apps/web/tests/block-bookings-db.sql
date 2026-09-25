-- Run only in a disposable local PostgreSQL cluster after the block migration.
\set ON_ERROR_STOP on
begin;
set local role service_role;
do $$
declare lane text:=gen_random_uuid()::text; q uuid; q2 uuid; cfg jsonb; occurrences jsonb; b jsonb; again jsonb; child_count integer;
 customer jsonb:='{"name":"Synthetic block","email":"block@example.invalid"}';
begin
 insert into public.resources(id,name,type) values(lane,'SYNTHETIC BLOCK','lane');
 select jsonb_build_object(
  'resources',(select jsonb_agg(r order by id) from public.resources r),
  'resource_availability_rules',(select coalesce(jsonb_agg(r order by id),'[]') from public.resource_availability_rules r),
  'pricing_rules',(select coalesce(jsonb_agg(r order by id),'[]') from public.pricing_rules r),
  'slot_overrides',(select coalesce(jsonb_agg(r order by id),'[]') from public.slot_overrides r),
  'blocked_slots',(select coalesce(jsonb_agg(r order by id),'[]') from public.blocked_slots r)) into cfg;
 occurrences:=jsonb_build_array(
  jsonb_build_object('resourceId',lane,'pricingResourceId',lane,'bookingDate','2035-02-01','startAt','2035-02-01T15:00:00Z','endAt','2035-02-01T16:00:00Z','bufferMinutes',15,'amountPence',2500),
  jsonb_build_object('resourceId',lane,'pricingResourceId',lane,'bookingDate','2035-02-08','startAt','2035-02-08T15:00:00Z','endAt','2035-02-08T16:00:00Z','bufferMinutes',15,'amountPence',3000));
 insert into public.block_booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
 values(repeat('a',64),jsonb_build_object('resourceId',lane),jsonb_build_object('occurrences',occurrences),cfg,5500,now()+interval '10 minutes') returning id into q;
 begin
  perform public.reserve_block_booking(q,repeat('b',64),customer,'https://example.invalid');
  raise exception 'TEST FAILED: wrong capability accepted';
 exception when no_data_found then null; end;
 b:=public.reserve_block_booking(q,repeat('a',64),customer,'https://example.invalid');
 assert b->>'booking_reference' ~ '^CCOE-[A-HJ-NP-Z2-9]{6}$', 'customer reference must use the short CCOE format';
 assert (b->>'amount')::numeric=55, 'normal rates must sum without discount';
 assert (select count(*) from public.bookings where block_booking_id=(b->>'id')::uuid)=2;
 assert (select sum(amount) from public.bookings where block_booking_id=(b->>'id')::uuid)=55;
 assert (select count(*) from public.checkout_attempts where block_booking_id=(b->>'id')::uuid)=1;
 again:=public.reserve_block_booking(q,repeat('a',64),customer,'https://example.invalid');
 assert again->>'id'=b->>'id', 'retry must reuse block';
 perform public.attach_block_checkout('block:'||(b->>'id'),'cs_synthetic_block');
 begin
  perform public.confirm_block_booking((b->>'id')::uuid,'cs_synthetic_block','{"currency":"gbp","amount":5000}');
  raise exception 'TEST FAILED: discounted payment accepted';
 exception when others then assert sqlerrm='Block payment mismatch'; end;
 assert public.confirm_block_booking((b->>'id')::uuid,'cs_synthetic_block','{"currency":"gbp","amount":5500,"reference":"pi_synthetic","live":false}');
 assert not public.confirm_block_booking((b->>'id')::uuid,'cs_synthetic_block','{"currency":"gbp","amount":5500}');
 assert (select count(*) from public.bookings where block_booking_id=(b->>'id')::uuid and status='confirmed' and payment_status='paid')=2;
 assert (select count(*) from public.booking_notification_outbox o join public.bookings c on c.id=o.resource_booking_id where c.block_booking_id=(b->>'id')::uuid)=2;
 assert (select sum((payment->>'amount')::integer) from public.booking_notification_outbox o join public.bookings c on c.id=o.resource_booking_id where c.block_booking_id=(b->>'id')::uuid and recipient_role='customer')=5500;
 perform public.expire_block_booking((b->>'id')::uuid,'cs_synthetic_block');
 assert (select status='confirmed' from public.block_bookings where id=(b->>'id')::uuid), 'late expiry cannot undo paid block';

 -- First occurrence is free, second overlaps a paid booking: nothing persists.
 occurrences:=jsonb_set(occurrences,'{0,bookingDate}','"2035-01-25"');
 occurrences:=jsonb_set(occurrences,'{0,startAt}','"2035-01-25T15:00:00Z"');
 occurrences:=jsonb_set(occurrences,'{0,endAt}','"2035-01-25T16:00:00Z"');
 insert into public.block_booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
 values(repeat('a',64),jsonb_build_object('resourceId',lane),jsonb_build_object('occurrences',occurrences),cfg,5500,now()+interval '10 minutes') returning id into q2;
 select count(*) into child_count from public.bookings;
 begin
  perform public.reserve_block_booking(q2,repeat('a',64),customer,'https://example.invalid');
  raise exception 'TEST FAILED: partial block accepted';
 exception when others then assert sqlerrm='Time is unavailable'; end;
 assert not exists(select 1 from public.block_bookings where quote_id=q2);
 assert (select count(*) from public.bookings)=child_count, 'first session must roll back';

 update public.block_booking_quotes set expires_at=now()-interval '1 second' where id=q2;
 begin
  perform public.reserve_block_booking(q2,repeat('a',64),customer,'https://example.invalid');
  raise exception 'TEST FAILED: expired quote accepted';
 exception when others then assert sqlerrm='Block quote expired'; end;
 update public.block_booking_quotes set expires_at=now()+interval '10 minutes',snapshot=jsonb_build_object('occurrences',jsonb_build_array(occurrences->0)),amount_pence=2500 where id=q2;
 update public.resources set name='CHANGED' where id=lane;
 begin
  perform public.reserve_block_booking(q2,repeat('a',64),customer,'https://example.invalid');
  raise exception 'TEST FAILED: changed configuration accepted';
 exception when others then assert sqlerrm='Configuration changed; review a fresh quote'; end;
 update public.resources set name='SYNTHETIC BLOCK' where id=lane;
 b:=public.reserve_block_booking(q2,repeat('a',64),customer,'https://example.invalid');
 perform public.attach_block_checkout('block:'||(b->>'id'),'cs_synthetic_expiry');
 begin
  perform public.expire_block_booking((b->>'id')::uuid,'cs_wrong');
  raise exception 'TEST FAILED: wrong session released block';
 exception when others then assert sqlerrm='Block session mismatch'; end;
 perform public.expire_block_booking((b->>'id')::uuid,'cs_synthetic_expiry');
 assert not exists(select 1 from public.bookings where block_booking_id=(b->>'id')::uuid and status<>'cancelled');
 assert (select resolved from public.checkout_attempts where block_booking_id=(b->>'id')::uuid);
 assert not has_table_privilege('anon','public.block_booking_quotes','SELECT');
 assert not has_table_privilege('authenticated','public.block_bookings','SELECT');
 assert not has_function_privilege('anon','public.reserve_block_booking(uuid,text,jsonb,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.confirm_block_booking(uuid,text,jsonb)','EXECUTE');
 raise notice 'PASS: full price, atomic rollback, retries, capabilities, config, expiry, payment validation, idempotent confirmation, receipts and permissions';
end $$;
rollback;

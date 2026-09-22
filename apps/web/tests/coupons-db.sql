\set ON_ERROR_STOP on
begin;
do $$
#variable_conflict use_column
declare c jsonb; c2 jsonb; b jsonb; id text; service text; cfg jsonb; quote uuid; i integer:=0;
begin
 assert not has_table_privilege('anon','public.coupons','select');
 assert not has_table_privilege('authenticated','public.coupon_redemptions','select');
 assert not has_function_privilege('anon','public.admin_save_coupon(text,uuid,integer,jsonb)','execute');
 assert not has_function_privilege('authenticated','public.apply_booking_coupon(text,text,text,integer,text,uuid)','execute');
 c:=public.admin_save_coupon('create',null,null,jsonb_build_object('code','TESTCOACH15','percent_off',15,'max_uses',50,'starts_at',now()-interval '1 day','expires_at',now()+interval '30 days','status','active'));
 c2:=public.admin_save_coupon('create',null,null,jsonb_build_object('code','TESTCOACH20','percent_off',20,'max_uses',50,'starts_at',now()-interval '1 day','expires_at',now()+interval '30 days','status','active'));
 insert into public.resources(id,name,type) values('coupon-synthetic-lane','Coupon synthetic lane','lane');
 foreach service in array array['lane_hire','side_arm','bowling_machine'] loop
  i:=i+1; id:='coupon-synthetic-'||service;
  insert into public.bookings(id,booking_reference,resource_id,service_type,booking_date,start_at,end_at,amount,customer_name,customer_email,status,payment_status)
   values(id,id,'coupon-synthetic-lane',service::public.service_type,'2039-01-01','2039-01-01T15:00:00Z'::timestamptz+i*interval '2 hours','2039-01-01T16:00:00Z'::timestamptz+i*interval '2 hours',40,'Synthetic','synthetic@example.invalid','pending_payment','pending');
  b:=public.apply_booking_coupon('resource',id,'TESTCOACH15',1,lpad(i::text,64,'0'),null);
  assert (b->>'amount')::numeric=34;
  assert (b->'coupon_snapshot'->>'discountMinor')::integer=600;
  assert public.apply_booking_coupon('resource',id,'TESTCOACH15',1,lpad(i::text,64,'0'),null)->>'id'=id;
 end loop;
 -- Resource quote wrapper preserves the authoritative subtotal and atomically
 -- reserves both inventory and promotion, rather than discounting a client price.
 cfg:=jsonb_build_object('resources',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.resources t),
 'resource_availability_rules',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.resource_availability_rules t),
 'pricing_rules',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.pricing_rules t),
 'slot_overrides',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.slot_overrides t),
 'blocked_slots',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.blocked_slots t));
 insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at) values(repeat('c',64),
 '{"serviceType":"lane_hire","bookingDate":"2039-02-01"}',
 '{"resourceId":"coupon-synthetic-lane","pricingResourceId":"coupon-synthetic-lane","startAt":"2039-02-01T15:00:00Z","endAt":"2039-02-01T16:00:00Z","bufferMinutes":0}',cfg,4000,now()+interval '10 minutes') returning booking_quotes.id into quote;
 begin
  perform public.reserve_quote_with_coupon(quote,repeat('c',64),'{"name":"Synthetic","email":"synthetic@example.invalid"}',true,'TESTCOACH20',999,lpad('6',64,'0'),null);
  raise exception 'TEST FAILED stale coupon preview';
 exception when others then assert sqlerrm='Coupon unavailable',sqlerrm; end;
 assert not exists(select 1 from public.bookings where quote_id=quote);
 b:=public.reserve_quote_with_coupon(quote,repeat('c',64),'{"name":"Synthetic","email":"synthetic@example.invalid"}',true,'TESTCOACH20',1,lpad('6',64,'0'),null);
 assert (b->>'amount')::numeric=32;
 assert (b->'coupon_snapshot'->>'subtotalMinor')::integer=4000;
 insert into public.group_sessions(id,title,age_group,max_players,schedule,price) values('coupon-synthetic-session','Synthetic','11-15',10,'Synthetic',40);
 for i in 4..5 loop
  id:='coupon-synthetic-group-'||i;
  b:=public.reserve_group_with_coupon(jsonb_build_object('id',id,'session_id','coupon-synthetic-session','player_name','Synthetic','player_age',12,'parent_name','Synthetic','parent_email','synthetic@example.invalid','parent_phone','000','amount',40,'status','pending_payment','payment_status','pending','request_hash',lpad(i::text,64,'0'),'checkout_description','Synthetic','checkout_service_type',case when i=4 then 'group_session' else 'masterclass' end),'TESTCOACH20',1,lpad(i::text,64,'0'),null);
  assert (b->>'amount')::numeric=32;
 end loop;
 -- Same email cannot use a second code in another booking family. Transaction
 -- failure also rolls back the group's capacity reservation.
 begin
  perform public.reserve_group_with_coupon(jsonb_build_object('id','coupon-denied','session_id','coupon-synthetic-session','player_name','Synthetic','player_age',12,'parent_name','Synthetic','parent_email','synthetic@example.invalid','parent_phone','000','amount',40,'status','pending_payment','payment_status','pending','request_hash',repeat('a',64),'checkout_description','Synthetic','checkout_service_type','group_session'), 'TESTCOACH20',1,lpad('1',64,'0'),null);
  raise exception 'TEST FAILED duplicate customer accepted';
 exception when others then assert sqlerrm='Coupon unavailable',sqlerrm; end;
 assert not exists(select 1 from public.group_session_bookings where id='coupon-denied');
 -- Paid confirmation settles exactly once; disabling/removing a coupon does
 -- not mutate agreed or paid totals. Refund policy does not restore a use.
 update public.bookings set stripe_session_id='cs_coupon',payment_status='paid',status='confirmed' where id='coupon-synthetic-lane_hire';
 assert (select count(*) from public.coupon_redemptions where state='redeemed')=1;
 update public.bookings set payment_status='paid' where id='coupon-synthetic-lane_hire';
 assert (select count(*) from public.coupon_redemptions where state='redeemed')=1;
 update public.bookings set stripe_session_id='cs_expired',payment_status='failed',status='cancelled' where id='coupon-synthetic-side_arm';
 assert (select state from public.coupon_redemptions where resource_booking_id='coupon-synthetic-side_arm')='released';
 c:=public.admin_save_coupon('update',(c->>'id')::uuid,1,c||jsonb_build_object('percent_off',25,'status','disabled'));
 assert (c->>'version')::integer=2;
 assert (select amount from public.bookings where id='coupon-synthetic-lane_hire')=34;
 begin
  perform public.admin_save_coupon('archive',(c->>'id')::uuid,1,null);
  raise exception 'TEST FAILED stale edit';
 exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
 c:=public.admin_save_coupon('archive',(c->>'id')::uuid,2,null);
 assert c->>'status'='archived';
 assert public.apply_booking_coupon('resource','coupon-synthetic-bowling_machine','TESTCOACH15',1,lpad('3',64,'0'),null)->>'amount' is not null;
 assert (select count(*) from public.coupon_audit where coupon_id=(c->>'id')::uuid)=3;
 begin
  perform public.admin_save_coupon('create',null,null,c);
  raise exception 'TEST FAILED reused archived code';
 exception when unique_violation then null; end;
 -- Expiry and preview-version changes fail rather than increasing the price.
 update public.coupons set expires_at=now()-interval '1 hour' where id=(c2->>'id')::uuid;
 begin
  perform public.reserve_group_with_coupon(jsonb_build_object('id','coupon-expired','session_id','coupon-synthetic-session','player_name','Synthetic','parent_name','Synthetic','parent_email','synthetic@example.invalid','parent_phone','000','amount',40,'status','pending_payment','payment_status','pending','request_hash',repeat('b',64),'checkout_description','Synthetic','checkout_service_type','group_session'),'TESTCOACH20',1,lpad('9',64,'0'),null);
  raise exception 'TEST FAILED expired code';
 exception when others then assert sqlerrm='Coupon unavailable',sqlerrm; end;
 assert not exists(select 1 from public.group_session_bookings where id='coupon-expired');
 raise notice 'PASS: admin create/edit/archive, RLS, all paid types, shared customer cap, immutable totals, settlement, terminal release, expiry, stale edits and audit';
end $$;
rollback;

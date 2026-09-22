-- Synthetic local fixture only. Every record is rolled back, no provider sends.
\set ON_ERROR_STOP on
begin;
do $$
declare
  cfg jsonb; quote uuid; booking jsonb; group_booking jsonb;
  consent jsonb:=jsonb_build_object('phone','447700900123','version','transactional-v1','grantedAt',now());
begin
  insert into public.resources(id,name,type) values('merge-synthetic-lane','Merge synthetic lane','lane');
  cfg:=jsonb_build_object(
    'resources',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.resources t),
    'resource_availability_rules',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.resource_availability_rules t),
    'pricing_rules',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.pricing_rules t),
    'slot_overrides',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.slot_overrides t),
    'blocked_slots',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.blocked_slots t));
  insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
    values(repeat('a',64),' {"serviceType":"lane_hire","bookingDate":"2039-03-01"}',
      '{"resourceId":"merge-synthetic-lane","pricingResourceId":"merge-synthetic-lane","startAt":"2039-03-01T15:00:00Z","endAt":"2039-03-01T16:00:00Z","bufferMinutes":0}',cfg,4000,now()+interval '10 minutes') returning id into quote;
  perform public.admin_save_coupon('create',null,null,jsonb_build_object('code','MERGETEST15','percent_off',15,'max_uses',50,'starts_at',now()-interval '1 day','expires_at',now()+interval '30 days','status','active'));
  booking:=public.reserve_quote_with_coupon(quote,repeat('a',64),jsonb_build_object('name','Synthetic','email','synthetic@example.invalid','phone','+447700900123','whatsapp_consent',consent),true,'MERGETEST15',1,repeat('1',64),null);
  assert booking->'whatsapp_consent'=consent;
  assert (booking->>'amount')::numeric=34;
  assert not exists(select 1 from public.whatsapp_jobs where source_id=booking->>'id');
  -- A quote retry must not overwrite previously recorded consent.
  assert public.reserve_booking_quote(quote,repeat('a',64),'{}',true)->'whatsapp_consent'=consent;
  update public.bookings set stripe_session_id='cs_merge_resource' where id=booking->>'id';
  perform public.confirm_booking_with_outbox('resource',booking->>'id','cs_merge_resource','{"amount":3400,"currency":"gbp"}');
  perform public.confirm_booking_with_outbox('resource',booking->>'id','cs_merge_resource','{"amount":3400,"currency":"gbp"}');
  assert (select count(*) from public.whatsapp_jobs where source_table='bookings' and source_id=booking->>'id')=1;
  assert (select count(*) from public.booking_notification_outbox where resource_booking_id=booking->>'id')=2;
  assert (select state from public.coupon_redemptions where resource_booking_id=booking->>'id')='redeemed';

  insert into public.group_sessions(id,title,age_group,max_players,schedule,price)
    values('merge-synthetic-session','Synthetic','11-15',10,'Synthetic',40);
  group_booking:=public.reserve_group_with_coupon(jsonb_build_object('id','merge-synthetic-group','session_id','merge-synthetic-session','player_name','Synthetic','player_age',12,'parent_name','Synthetic','parent_email','synthetic@example.invalid','parent_phone','+447700900123','amount',40,'status','pending_payment','payment_status','pending','request_hash',repeat('b',64),'checkout_description','Synthetic','checkout_service_type','group_session','whatsapp_consent',consent),'MERGETEST15',1,repeat('2',64),null);
  assert group_booking->'whatsapp_consent'=consent;
  assert (group_booking->>'amount')::numeric=34;
  assert not exists(select 1 from public.whatsapp_jobs where source_id=group_booking->>'id');
  update public.group_session_bookings set stripe_session_id='cs_merge_group' where id=group_booking->>'id';
  perform public.confirm_booking_with_outbox('group',group_booking->>'id','cs_merge_group','{"amount":3400,"currency":"gbp"}');
  perform public.confirm_booking_with_outbox('group',group_booking->>'id','cs_merge_group','{"amount":3400,"currency":"gbp"}');
  assert (select count(*) from public.whatsapp_jobs where source_table='group_session_bookings' and source_id=group_booking->>'id')=1;
  assert (select count(*) from public.booking_notification_outbox where group_booking_id=group_booking->>'id')=1;
  assert (select state from public.coupon_redemptions where group_booking_id=group_booking->>'id')='redeemed';
end $$;
rollback;

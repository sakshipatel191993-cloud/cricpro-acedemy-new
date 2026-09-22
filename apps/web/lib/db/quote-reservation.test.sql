-- Isolated database only. Entire synthetic fixture is rolled back.
begin;
do $$
declare
  lane text := gen_random_uuid()::text;
  quote_id uuid; second_quote uuid; expired_quote uuid;
  cfg jsonb; snap jsonb; payload jsonb; first_booking jsonb; again jsonb;
  starts timestamptz := date_trunc('day',now()) + interval '2 days 15 hours';
begin
  insert into public.resources(id,name,type,active) values(lane,'SYNTHETIC QUOTE TEST','lane',true);
  select jsonb_build_object(
    'resources',(select coalesce(jsonb_agg(r order by id),'[]'::jsonb) from public.resources r),
    'resource_availability_rules',(select coalesce(jsonb_agg(r order by id),'[]'::jsonb) from public.resource_availability_rules r),
    'pricing_rules',(select coalesce(jsonb_agg(r order by id),'[]'::jsonb) from public.pricing_rules r),
    'slot_overrides',(select coalesce(jsonb_agg(r order by id),'[]'::jsonb) from public.slot_overrides r),
    'blocked_slots',(select coalesce(jsonb_agg(r order by id),'[]'::jsonb) from public.blocked_slots r)
  ) into cfg;
  snap := jsonb_build_object('resourceId',lane,'pricingResourceId',lane,'startAt',starts,'endAt',starts+interval '2 hours','bufferMinutes',15);
  payload := jsonb_build_object('serviceType','lane_hire','bookingDate',starts::date);
  insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
    values(repeat('a',64),payload,snap,cfg,4000,now()+interval '10 minutes') returning id into quote_id;
  first_booking := public.reserve_booking_quote(quote_id,repeat('a',64),'{"name":"Synthetic Tester","email":"synthetic@example.invalid"}',true);
  assert (first_booking->>'amount')::numeric = 40, 'stored amount must equal quote';
  again := public.reserve_booking_quote(quote_id,repeat('a',64),'{"name":"Synthetic Tester","email":"synthetic@example.invalid"}',true);
  assert first_booking->>'id' = again->>'id', 'retry must reuse booking';
  begin
    perform public.reserve_booking_quote(quote_id,repeat('b',64),'{}',true);
    raise exception 'TEST FAILED: wrong capability accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    assert sqlerrm = 'Quote unavailable';
  end;
  insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
    values(repeat('a',64),payload,snap || jsonb_build_object('startAt',starts+interval '2 hours 10 minutes','endAt',starts+interval '3 hours 10 minutes'),cfg,2500,now()+interval '10 minutes') returning id into second_quote;
  begin
    perform public.reserve_booking_quote(second_quote,repeat('a',64),'{"name":"Synthetic Tester","email":"synthetic@example.invalid"}',true);
    raise exception 'TEST FAILED: overlapping buffer accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    assert sqlerrm = 'Time is unavailable';
  end;
  insert into public.booking_quotes(capability_hash,input,snapshot,configuration,amount_pence,expires_at)
    values(repeat('a',64),payload,snap,cfg,4000,now()-interval '1 second') returning id into expired_quote;
  begin
    perform public.reserve_booking_quote(expired_quote,repeat('a',64),'{}',true);
    raise exception 'TEST FAILED: expired quote accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    assert sqlerrm = 'Quote expired';
  end;
  update public.resources set name='SYNTHETIC CHANGED CONFIG' where id=lane;
  begin
    perform public.reserve_booking_quote(second_quote,repeat('a',64),'{}',true);
    raise exception 'TEST FAILED: changed config accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    assert sqlerrm = 'Configuration changed; review a fresh quote';
  end;
  assert not has_table_privilege('anon','public.booking_quotes','SELECT');
  assert not has_function_privilege('authenticated','public.reserve_booking_quote(uuid,text,jsonb,boolean)','EXECUTE');
  raise notice 'PASS: quote amount, retry, capability, buffer, expiry, config and privileges';
end $$;
rollback;

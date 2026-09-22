-- Run ONLY on isolated synthetic local Postgres after the migration. Rolls back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.resources(id,name,type) values('guest-test-lane','Synthetic test lane','lane');
insert into public.bookings(id,booking_reference,resource_id,service_type,booking_date,start_at,end_at,amount,customer_name,customer_email)
values('guest-test-booking','TEST-GUEST-ONLY','guest-test-lane','lane_hire','2030-01-01','2030-01-01 15:00+00','2030-01-01 16:00+00',25,'Synthetic guest','synthetic@example.invalid');
insert into public.booking_access_scopes(id,booking_id) values('00000000-0000-4000-8000-000000000003','guest-test-booking');
do $$
declare v uuid := '00000000-0000-4000-8000-000000000003';
begin
 if has_table_privilege('anon','public.booking_access_links','SELECT') or has_table_privilege('authenticated','public.booking_access_sessions','SELECT') then raise exception 'Browser role can read secrets'; end if;
 if has_function_privilege('anon','public.exchange_booking_access_link(text,text)','EXECUTE') then raise exception 'Anonymous exchange RPC exposed'; end if;
 if not public.issue_booking_access_link(v,'hash-one') then raise exception 'Issuance failed'; end if;
 if public.issue_booking_access_link(v,'hash-two') then raise exception 'Resend spacing bypassed'; end if;
 if public.exchange_booking_access_link('hash-one','session-one') is distinct from v then raise exception 'Exchange failed'; end if;
 if public.exchange_booking_access_link('hash-one','session-replay') is not null then raise exception 'Link replay allowed'; end if;
 if (select count(*) from public.touch_booking_access_session('session-one')) <> 1 then raise exception 'Valid session rejected'; end if;
 if not public.claim_booking_access('session-one','00000000-0000-4000-8000-000000000001') then raise exception 'Fresh claim failed'; end if;
 if public.claim_booking_access('session-one','00000000-0000-4000-8000-000000000002') then raise exception 'Claim replay/owner replacement allowed'; end if;
 update public.booking_access_sessions set last_seen_at=now()-interval '31 minutes' where token_hash='session-one';
 if exists(select 1 from public.touch_booking_access_session('session-one')) then raise exception 'Idle expiry bypassed'; end if;
 update public.booking_access_sessions set last_seen_at=now(),expires_at=now()-interval '1 second' where token_hash='session-one';
 if exists(select 1 from public.touch_booking_access_session('session-one')) then raise exception 'Absolute expiry bypassed'; end if;
 insert into public.booking_access_links(token_hash,scope_id,access_version,expires_at) values('expired-link',v,1,now()-interval '1 second');
 if public.exchange_booking_access_link('expired-link','expired-session') is not null then raise exception 'Expired link exchanged'; end if;
 insert into public.booking_access_sessions(token_hash,scope_id,access_version) values('creator-session',v,1);
 if public.claim_booking_access('creator-session','00000000-0000-4000-8000-000000000002') then raise exception 'Creator capability substituted for email proof'; end if;
 insert into public.booking_access_links(token_hash,scope_id,access_version) values('revoked-by-version',v,1);
 if not public.revoke_booking_access(v) then raise exception 'Revocation failed'; end if;
 if exists(select 1 from public.touch_booking_access_session('creator-session')) then raise exception 'Scope revocation bypassed'; end if;
 if public.exchange_booking_access_link('revoked-by-version','bad-session') is not null then raise exception 'Revoked link exchanged'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.booking_access_links; raise exception 'anon table access allowed'; exception when insufficient_privilege then null; end;
 begin perform public.exchange_booking_access_link('x','y'); raise exception 'anon RPC access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo PASS guest token single-use, spacing, expiry, fresh proof, ownership conflict, revocation and real anon permissions

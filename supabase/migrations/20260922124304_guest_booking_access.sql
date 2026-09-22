-- Local reviewed migration only. Never expose these tables to browser roles.
create table public.booking_access_scopes (
 id uuid primary key default gen_random_uuid(),
 booking_id text unique references public.bookings(id) on delete cascade,
 group_booking_id text unique references public.group_session_bookings(id) on delete cascade,
 owner_id uuid references auth.users(id) on delete set null,
 access_version integer not null default 1,
 check (num_nonnulls(booking_id, group_booking_id) = 1)
);
create index booking_access_owner_idx on public.booking_access_scopes(owner_id);
create table public.booking_access_links (
 token_hash text primary key,
 scope_id uuid not null references public.booking_access_scopes(id) on delete cascade,
 access_version integer not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '15 minutes',
 consumed_at timestamptz,
 revoked_at timestamptz
);
create index booking_access_link_scope_idx on public.booking_access_links(scope_id, created_at desc);
create table public.booking_access_sessions (
 token_hash text primary key,
 scope_id uuid not null references public.booking_access_scopes(id) on delete cascade,
 access_version integer not null,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '24 hours',
 email_verified_at timestamptz,
 revoked_at timestamptz
);
create index booking_access_session_scope_idx on public.booking_access_sessions(scope_id);
alter table public.booking_access_scopes enable row level security;
alter table public.booking_access_links enable row level security;
alter table public.booking_access_sessions enable row level security;
revoke all on public.booking_access_scopes, public.booking_access_links, public.booking_access_sessions from public, anon, authenticated;
grant all on public.booking_access_scopes, public.booking_access_links, public.booking_access_sessions to service_role;

-- Serialise issuance per booking, preventing concurrent resend bypass.
create function public.issue_booking_access_link(p_scope uuid, p_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v integer;
begin
 select access_version into v from public.booking_access_scopes where id=p_scope for update;
 if not found then return false; end if;
 if exists(select 1 from public.booking_access_links where scope_id=p_scope and created_at>now()-interval '60 seconds') then return false; end if;
 update public.booking_access_links set revoked_at=now() where scope_id=p_scope and consumed_at is null and revoked_at is null;
 insert into public.booking_access_links(token_hash,scope_id,access_version) values(p_hash,p_scope,v);
 return true;
end $$;
create function public.exchange_booking_access_link(p_hash text, p_session_hash text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare l public.booking_access_links;
begin
 update public.booking_access_links set consumed_at=now()
 where token_hash=p_hash and consumed_at is null and revoked_at is null and expires_at>now()
 and access_version=(select access_version from public.booking_access_scopes where id=scope_id)
 returning * into l;
 if not found then return null; end if;
 insert into public.booking_access_sessions(token_hash,scope_id,access_version,email_verified_at)
 values(p_session_hash,l.scope_id,l.access_version,now());
 return l.scope_id;
end $$;
create function public.touch_booking_access_session(p_hash text) returns setof public.booking_access_sessions
language sql security invoker set search_path = '' as $$
 update public.booking_access_sessions s set last_seen_at=now()
 where s.token_hash=p_hash and s.revoked_at is null and s.expires_at>now()
 and s.last_seen_at>now()-interval '30 minutes'
 and s.access_version=(select access_version from public.booking_access_scopes where id=s.scope_id)
 returning s.*;
$$;
create function public.claim_booking_access(p_hash text, p_owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare s public.booking_access_sessions;
begin
 select * into s from public.booking_access_sessions where token_hash=p_hash and revoked_at is null
 and expires_at>now() and last_seen_at>now()-interval '30 minutes'
 and email_verified_at>now()-interval '15 minutes' for update;
 if not found then return false; end if;
 update public.booking_access_scopes set owner_id=p_owner
 where id=s.scope_id and access_version=s.access_version and (owner_id is null or owner_id=p_owner);
 if not found then return false; end if;
 -- Fresh email proof may attach only once, including under concurrent claims.
 update public.booking_access_sessions set email_verified_at=null where token_hash=p_hash;
 return true;
end $$;
revoke all on function public.issue_booking_access_link(uuid,text), public.exchange_booking_access_link(text,text), public.touch_booking_access_session(text), public.claim_booking_access(text,uuid) from public,anon,authenticated;
grant execute on function public.issue_booking_access_link(uuid,text), public.exchange_booking_access_link(text,text), public.touch_booking_access_session(text), public.claim_booking_access(text,uuid) to service_role;

create function public.revoke_booking_access(p_scope uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 update public.booking_access_scopes set access_version=access_version+1 where id=p_scope;
 return found;
end $$;
revoke all on function public.revoke_booking_access(uuid) from public,anon,authenticated;
grant execute on function public.revoke_booking_access(uuid) to service_role;

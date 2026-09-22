-- Additive: historical rows remain unchanged. New server-created reservations
-- bind their deterministic primary key to a private browser capability/request ID.
alter table public.group_session_bookings
  add column request_hash text,
  add column checkout_description text,
  add column checkout_service_type text;
alter table public.group_session_bookings add constraint group_checkout_request_snapshot check (
  request_hash is null or (
    request_hash ~ '^[a-f0-9]{64}$' and
    checkout_description is not null and
    checkout_service_type is not null and
    checkout_service_type in ('group_session','masterclass')
  )
);

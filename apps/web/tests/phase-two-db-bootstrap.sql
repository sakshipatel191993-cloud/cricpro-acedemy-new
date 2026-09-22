-- TEST ONLY: run in a newly initialised, disposable local PostgreSQL cluster.
-- Never run against an existing Supabase or production database.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
\ir ../lib/db/supabase-setup.sql
grant usage on schema public, auth to service_role;
grant all on all tables in schema public to service_role;
grant select on auth.users to service_role;
grant all on all sequences in schema public to service_role;

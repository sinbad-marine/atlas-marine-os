-- Run with psql -X -v ON_ERROR_STOP=1 -f this-file.sql against a disposable,
-- EMPTY PostgreSQL test database as its administrator. Never target Supabase
-- production. The auth-schema guard rejects initialized Supabase databases.
-- Everything, including fixtures and migrations, is rolled back on success.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if to_regnamespace('auth') is not null then
    raise exception 'EMPTY_TEST_DATABASE_REQUIRED';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create table public.workspaces(id uuid primary key);

\ir ../../supabase/migrations/20260829_founder_owner_step_up.sql
\ir ../../supabase/migrations/20260903_founder_owner_atomic_issuance.sql
\ir ../../supabase/migrations/20260903000100_founder_owner_consumption_lock.sql
\ir ../../supabase/migrations/20260903000200_founder_owner_consumption_expiry.sql

insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.founder_principals(user_id) values ('11111111-1111-4111-8111-111111111111');

-- Inject a database audit failure, not an HTTP mock failure.
create function public.test_fail_founder_issue_audit() returns trigger language plpgsql as $$
begin
  if new.event_type = 'step_up_issued' then
    raise exception using errcode = 'ZX001', message = 'injected audit failure';
  end if;
  return new;
end $$;
create trigger test_fail_issue_audit before insert on public.founder_security_audit
for each row execute function public.test_fail_founder_issue_audit();

do $$ begin
  begin
    perform * from public.issue_founder_step_up(
      '11111111-1111-4111-8111-111111111111', null,
      'identity.member.set_role', 'workspace_member', 'fixture',
      repeat('a',64), repeat('b',64), 'test-session');
    raise exception 'EXPECTED_AUDIT_FAILURE';
  exception when sqlstate 'ZX001' then null;
  end;
  if exists (select 1 from public.founder_step_up_authorizations)
     or exists (select 1 from public.founder_security_audit) then
    raise exception 'AUDIT_FAILURE_LEFT_PARTIAL_ISSUANCE';
  end if;
end $$;
drop trigger test_fail_issue_audit on public.founder_security_audit;

do $$
declare
  grant_id uuid;
  expiry timestamptz;
  binding text := 'public.issue_founder_step_up(uuid,uuid,text,text,text,text,text,text)';
begin
  if has_function_privilege('anon',binding,'EXECUTE')
     or has_function_privilege('authenticated',binding,'EXECUTE')
     or not has_function_privilege('service_role',binding,'EXECUTE') then
    raise exception 'ISSUANCE_PRIVILEGES_INVALID';
  end if;
  select id, expires_at into strict grant_id, expiry from public.issue_founder_step_up(
    '11111111-1111-4111-8111-111111111111', null,
    'identity.member.set_role', 'workspace_member', 'fixture',
    repeat('a',64), repeat('b',64), 'test-session');
  if (select count(*) from public.founder_step_up_authorizations) <> 1
     or (select count(*) from public.founder_security_audit where authorization_id = grant_id and event_type = 'step_up_issued' and command_hash = repeat('a',64)) <> 1
     or not exists (select 1 from public.founder_step_up_authorizations where id = grant_id and expires_at - issued_at = interval '5 minutes' and expires_at = expiry) then
    raise exception 'ISSUANCE_BINDING_OR_EXPIRY_INVALID';
  end if;
  begin
    perform * from public.issue_founder_step_up(
      '11111111-1111-4111-8111-111111111111', null,
      'identity.member.set_role', 'workspace_member', 'fixture',
      repeat('a',64), repeat('b',64), 'test-session');
    raise exception 'EXPECTED_NONCE_UNIQUENESS_FAILURE';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.founder_security_audit) <> 1 then
    raise exception 'DUPLICATE_NONCE_CREATED_AUDIT';
  end if;
  if not public.consume_founder_step_up(grant_id,
    '11111111-1111-4111-8111-111111111111', null,
    'identity.member.set_role', 'workspace_member', 'fixture',
    repeat('a',64), repeat('b',64), 'test-session') then
    raise exception 'VALID_GRANT_NOT_CONSUMED';
  end if;
  if public.consume_founder_step_up(grant_id,
    '11111111-1111-4111-8111-111111111111', null,
    'identity.member.set_role', 'workspace_member', 'fixture',
    repeat('a',64), repeat('b',64), 'test-session') then
    raise exception 'GRANT_REUSED';
  end if;
  update public.founder_principals set status = 'suspended';
  begin
    perform * from public.issue_founder_step_up(
      '11111111-1111-4111-8111-111111111111', null,
      'identity.member.set_role', 'workspace_member', 'fixture',
      repeat('a',64), repeat('c',64), 'test-session');
    raise exception 'SUSPENDED_PRINCIPAL_ISSUED_GRANT';
  exception when raise_exception then
    if sqlerrm <> 'ACTIVE_FOUNDER_REQUIRED' then raise; end if;
  end;
  if (select count(*) from public.founder_step_up_authorizations) <> 1 then
    raise exception 'SUSPENSION_LEFT_PARTIAL_ISSUANCE';
  end if;
end $$;
rollback;
\echo 'Founder issuance rollback, binding, expiry, ACL, reuse and suspension checks passed.'

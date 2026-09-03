-- Founder/Owner authority is bound to an Auth user UUID, never to an email or
-- a credential embedded in the client. Production enrollment is a separate,
-- controlled operation documented in docs/FOUNDER_OWNER_MFA.md.
create extension if not exists pgcrypto;

create table if not exists public.founder_principals (
  user_id uuid primary key references auth.users(id) on delete restrict,
  principal_key text not null default 'sinbad-founder' check (principal_key = 'sinbad-founder'),
  status text not null default 'active' check (status in ('active','suspended')),
  roles text[] not null default array['owner','security_admin','identity_admin','core_release_approver']::text[],
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  check (roles @> array['owner','security_admin','identity_admin','core_release_approver']::text[])
);

-- There may be only one active Sinbad founder principal.
create unique index if not exists founder_principals_one_active
  on public.founder_principals (principal_key) where status = 'active';

create table if not exists public.founder_step_up_authorizations (
  id uuid primary key default gen_random_uuid(),
  principal_user_id uuid not null references public.founder_principals(user_id) on delete restrict,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.:-]{2,127}$'),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_.:-]{1,63}$'),
  resource_id text not null check (length(resource_id) between 1 and 512),
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  nonce_hash text not null unique check (nonce_hash ~ '^[0-9a-f]{64}$'),
  auth_session_id text not null check (length(auth_session_id) between 1 and 512),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete restrict,
  check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes'),
  check ((consumed_at is null and consumed_by is null) or (consumed_at is not null and consumed_by is not null))
);

create index if not exists founder_step_up_principal_expiry
  on public.founder_step_up_authorizations(principal_user_id, expires_at desc);

create table if not exists public.founder_security_audit (
  id bigint generated always as identity primary key,
  principal_user_id uuid references auth.users(id) on delete restrict,
  authorization_id uuid references public.founder_step_up_authorizations(id) on delete restrict,
  event_type text not null check (event_type in ('principal_seeded','step_up_issued','step_up_consumed','step_up_denied','principal_suspended')),
  action text,
  resource_type text,
  resource_id text,
  command_hash text,
  request_id uuid not null default gen_random_uuid(),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);

alter table public.founder_principals enable row level security;
alter table public.founder_step_up_authorizations enable row level security;
alter table public.founder_security_audit enable row level security;

-- A founder may inspect their registry, grants and audit. No client role may
-- insert/update/delete these records; writes go through service-only functions.
create policy "founder reads own principal" on public.founder_principals for select
  using (user_id = auth.uid());
create policy "founder reads own step ups" on public.founder_step_up_authorizations for select
  using (principal_user_id = auth.uid());
create policy "founder reads own security audit" on public.founder_security_audit for select
  using (principal_user_id = auth.uid());

revoke all on public.founder_principals from anon, authenticated;
revoke all on public.founder_step_up_authorizations from anon, authenticated;
revoke all on public.founder_security_audit from anon, authenticated;
grant select on public.founder_principals to authenticated;
grant select on public.founder_step_up_authorizations to authenticated;
grant select on public.founder_security_audit to authenticated;

-- Defense in depth: even privileged application SQL cannot rewrite or delete
-- an audit event. The table owner may still operate during controlled recovery.
create or replace function public.reject_founder_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Founder security audit is append-only';
end $$;
drop trigger if exists founder_security_audit_immutable on public.founder_security_audit;
create trigger founder_security_audit_immutable
before update or delete on public.founder_security_audit
for each row execute function public.reject_founder_audit_mutation();

-- Called only by trusted Edge Functions after Supabase Auth has independently
-- verified the current JWT and its aal2 assurance level.
create or replace function public.consume_founder_step_up(
  p_authorization_id uuid,
  p_principal_user_id uuid,
  p_workspace_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_command_hash text,
  p_nonce_hash text,
  p_auth_session_id text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare consumed_id uuid;
begin
  update public.founder_step_up_authorizations a
     set consumed_at = clock_timestamp(), consumed_by = p_principal_user_id
   where a.id = p_authorization_id
     and a.principal_user_id = p_principal_user_id
     and a.workspace_id is not distinct from p_workspace_id
     and a.action = p_action
     and a.resource_type = p_resource_type
     and a.resource_id = p_resource_id
     and a.command_hash = p_command_hash
     and a.nonce_hash = p_nonce_hash
     and a.auth_session_id = p_auth_session_id
     and a.consumed_at is null
     and a.expires_at > clock_timestamp()
     and exists (
       select 1 from public.founder_principals f
        where f.user_id = p_principal_user_id and f.status = 'active'
     )
  returning a.id into consumed_id;

  if consumed_id is null then return false; end if;

  insert into public.founder_security_audit(
    principal_user_id, authorization_id, event_type, action,
    resource_type, resource_id, command_hash
  ) values (
    p_principal_user_id, consumed_id, 'step_up_consumed', p_action,
    p_resource_type, p_resource_id, p_command_hash
  );
  return true;
end $$;

revoke all on function public.consume_founder_step_up(uuid,uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.consume_founder_step_up(uuid,uuid,uuid,text,text,text,text,text,text) to service_role;

comment on table public.founder_principals is
  'UUID-only singleton registry. Never seed from a client or commit founder email/password/TOTP material.';
comment on function public.consume_founder_step_up(uuid,uuid,uuid,text,text,text,text,text,text) is
  'Service-only atomic one-time consumption. Caller must first verify Supabase Auth aal2.';

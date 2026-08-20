begin;

create extension if not exists pgcrypto;

create table public.rollout_recovery_deployment_reconciliation_audit (
  id bigint generated always as identity primary key,
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  authorization_hash text not null check (authorization_hash ~ '^[a-f0-9]{64}$'),
  purpose_hash text not null check (purpose_hash ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('AUTHORIZED','DENIED')),
  decided_at_ms bigint not null check (decided_at_ms >= 0),
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.rollout_recovery_deployment_reconciliation_audit enable row level security;
revoke all on public.rollout_recovery_deployment_reconciliation_audit from public, anon, authenticated;

create function public.reject_rollout_recovery_deployment_reconciliation_audit_mutation()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin raise exception 'deployment reconciliation audit rows are immutable'; end;
$$;
create trigger rollout_recovery_deployment_reconciliation_audit_immutable before update or delete on public.rollout_recovery_deployment_reconciliation_audit
for each row execute function public.reject_rollout_recovery_deployment_reconciliation_audit_mutation();
create trigger rollout_recovery_deployment_reconciliation_audit_no_truncate before truncate on public.rollout_recovery_deployment_reconciliation_audit
for each statement execute function public.reject_rollout_recovery_deployment_reconciliation_audit_mutation();

create function public.append_rollout_recovery_deployment_reconciliation_audit(
  p_actor_hash text,p_authorization_hash text,p_purpose_hash text,p_decision text,p_decided_at_ms bigint,p_event_hash text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_expected text; v_inserted integer;
begin
  if auth.role()<>'service_role' or p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$'
    or p_authorization_hash is null or p_authorization_hash !~ '^[a-f0-9]{64}$'
    or p_purpose_hash is null or p_purpose_hash !~ '^[a-f0-9]{64}$'
    or p_decision not in ('AUTHORIZED','DENIED') or p_decided_at_ms is null or p_decided_at_ms<0
    or p_event_hash is null or p_event_hash !~ '^[a-f0-9]{64}$' then return 'DENIED'; end if;
  v_expected := encode(digest(convert_to(
    'sinbad-rollout-recovery-deployment-reconciliation-audit/4G-v1' || chr(10) || p_actor_hash || chr(10) ||
    p_authorization_hash || chr(10) || p_purpose_hash || chr(10) || p_decision || chr(10) || p_decided_at_ms::text,
    'UTF8'), 'sha256'), 'hex');
  if p_event_hash<>v_expected then return 'HASH_MISMATCH'; end if;
  insert into public.rollout_recovery_deployment_reconciliation_audit(actor_hash,authorization_hash,purpose_hash,decision,decided_at_ms,event_hash)
  values(p_actor_hash,p_authorization_hash,p_purpose_hash,p_decision,p_decided_at_ms,p_event_hash)
  on conflict (event_hash) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=1 then return 'RECORDED'; end if;
  if exists(select 1 from public.rollout_recovery_deployment_reconciliation_audit a where a.event_hash=p_event_hash
    and a.actor_hash=p_actor_hash and a.authorization_hash=p_authorization_hash and a.purpose_hash=p_purpose_hash
    and a.decision=p_decision and a.decided_at_ms=p_decided_at_ms) then return 'ALREADY_RECORDED'; end if;
  return 'CONFLICT';
end;
$$;

revoke all on function public.reject_rollout_recovery_deployment_reconciliation_audit_mutation() from public, anon, authenticated;
revoke all on function public.append_rollout_recovery_deployment_reconciliation_audit(text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.append_rollout_recovery_deployment_reconciliation_audit(text,text,text,text,bigint,text) to service_role;

commit;

create table if not exists public.terminal_delivery_recovery_audit (
  id bigint generated always as identity primary key,
  claim_key text not null references public.terminal_delivery_idempotency(claim_key),
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  action text not null check (action = 'OPERATOR_QUARANTINED'),
  reason_code text not null check (reason_code in ('PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED')),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.terminal_delivery_recovery_audit enable row level security;
revoke all on public.terminal_delivery_recovery_audit from public, anon, authenticated;

do $$
begin
  if exists(select 1 from public.terminal_delivery_idempotency where
    (status='CLAIMED' and (summary is not null or settled_at is not null)) or
    (status='SETTLED' and (summary is null or settled_at is null)) or
    status not in ('CLAIMED','SETTLED')) then
    raise exception 'terminal delivery rows violate Phase 3B preconditions';
  end if;
end $$;

alter table public.terminal_delivery_idempotency drop constraint if exists terminal_delivery_idempotency_status_check;
alter table public.terminal_delivery_idempotency drop constraint if exists terminal_delivery_idempotency_check;
alter table public.terminal_delivery_idempotency add constraint terminal_delivery_idempotency_status_check check (status in ('CLAIMED','SETTLED','QUARANTINED'));
alter table public.terminal_delivery_idempotency add constraint terminal_delivery_idempotency_state_check check (
  (status = 'CLAIMED' and summary is null and settled_at is null) or
  (status in ('SETTLED','QUARANTINED') and summary is not null and settled_at is not null)
);

create or replace function public.claim_terminal_delivery(p_claim_key text, p_lease_ms integer)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_candidate uuid := gen_random_uuid(); v_token uuid;
begin
  if p_claim_key is null or p_claim_key !~ '^[a-f0-9]{64}$' or p_lease_ms < 1000 or p_lease_ms > 900000 then return null; end if;
  insert into public.terminal_delivery_idempotency(claim_key, lease_token, lease_expires_at)
  values (p_claim_key, v_candidate, clock_timestamp() + make_interval(secs => p_lease_ms / 1000.0))
  on conflict (claim_key) do nothing returning lease_token into v_token;
  return v_token;
end;
$$;

create or replace function public.list_expired_terminal_delivery_claims(p_limit integer default 100)
returns table(claim_key text, claimed_at timestamptz, lease_expires_at timestamptz)
language sql security definer set search_path = pg_catalog, public as $$
  select t.claim_key, t.claimed_at, t.lease_expires_at from public.terminal_delivery_idempotency t
  where t.status = 'CLAIMED' and t.lease_expires_at <= clock_timestamp()
  order by t.lease_expires_at asc, t.claim_key asc limit least(greatest(coalesce(p_limit,100),1),500)
$$;

create or replace function public.verify_terminal_recovery_access()
returns boolean language sql security definer set search_path = pg_catalog, public as $$
  select auth.role()='service_role'
    and to_regclass('public.terminal_delivery_idempotency') is not null
    and to_regclass('public.terminal_delivery_recovery_audit') is not null
    and to_regprocedure('public.quarantine_expired_terminal_delivery_claim(text,text,text)') is not null
$$;

create or replace function public.quarantine_expired_terminal_delivery_claim(p_claim_key text, p_actor_hash text, p_reason_code text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_updated integer;
begin
  if p_claim_key is null or p_claim_key !~ '^[a-f0-9]{64}$' or p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' or p_reason_code not in ('PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED') then return false; end if;
  update public.terminal_delivery_idempotency set status='QUARANTINED',summary=jsonb_build_object('status','TRUSTED_TERMINAL_DELIVERY_BLOCKED','outcome',null,'stage','OPERATOR_QUARANTINED'),settled_at=clock_timestamp()
  where claim_key=p_claim_key and status='CLAIMED' and lease_expires_at<=clock_timestamp();
  get diagnostics v_updated = row_count; if v_updated<>1 then return false; end if;
  insert into public.terminal_delivery_recovery_audit(claim_key,actor_hash,action,reason_code) values(p_claim_key,p_actor_hash,'OPERATOR_QUARANTINED',p_reason_code);
  return true;
end;
$$;

revoke all on function public.list_expired_terminal_delivery_claims(integer) from public, anon, authenticated;
revoke all on function public.verify_terminal_recovery_access() from public, anon, authenticated;
revoke all on function public.quarantine_expired_terminal_delivery_claim(text,text,text) from public, anon, authenticated;
grant execute on function public.list_expired_terminal_delivery_claims(integer) to service_role;
grant execute on function public.verify_terminal_recovery_access() to service_role;
grant execute on function public.claim_terminal_delivery(text,integer) to service_role;
grant execute on function public.quarantine_expired_terminal_delivery_claim(text,text,text) to service_role;

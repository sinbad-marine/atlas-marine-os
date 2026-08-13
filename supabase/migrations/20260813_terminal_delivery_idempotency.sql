create extension if not exists pgcrypto;

create table if not exists public.terminal_delivery_idempotency (
  claim_key text primary key check (claim_key ~ '^[a-f0-9]{64}$'),
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  status text not null default 'CLAIMED' check (status in ('CLAIMED','SETTLED')),
  summary jsonb,
  claimed_at timestamptz not null default clock_timestamp(),
  settled_at timestamptz,
  check ((status = 'CLAIMED' and summary is null and settled_at is null) or
         (status = 'SETTLED' and summary is not null and settled_at is not null))
);

alter table public.terminal_delivery_idempotency enable row level security;
revoke all on public.terminal_delivery_idempotency from public, anon, authenticated;

create or replace function public.claim_terminal_delivery(p_claim_key text, p_lease_ms integer)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_candidate uuid := gen_random_uuid();
  v_token uuid;
begin
  if p_claim_key is null or p_claim_key !~ '^[a-f0-9]{64}$' or p_lease_ms < 1000 or p_lease_ms > 900000 then
    return null;
  end if;

  insert into public.terminal_delivery_idempotency(claim_key, lease_token, lease_expires_at)
  values (p_claim_key, v_candidate, clock_timestamp() + make_interval(secs => p_lease_ms / 1000.0))
  on conflict (claim_key) do update
    set lease_token = excluded.lease_token,
        lease_expires_at = excluded.lease_expires_at,
        claimed_at = clock_timestamp()
    where terminal_delivery_idempotency.status = 'CLAIMED'
      and terminal_delivery_idempotency.lease_expires_at <= clock_timestamp()
  returning lease_token into v_token;

  return v_token;
end;
$$;

create or replace function public.settle_terminal_delivery(p_claim_key text, p_lease_token uuid, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_updated integer;
begin
  if p_claim_key is null or p_claim_key !~ '^[a-f0-9]{64}$' or p_lease_token is null or
     p_summary is null or jsonb_typeof(p_summary) <> 'object' or pg_column_size(p_summary) > 4096 or
     not (p_summary ? 'status') or not (p_summary ? 'outcome') or (p_summary - array['status','terminalState','outcome','transitionHash','stage','completionHash']) <> '{}'::jsonb or
     not (
       (p_summary->>'status' = 'TRUSTED_TERMINAL_DELIVERY_APPLIED' and
        p_summary->>'terminalState' in ('DELIVERY_SUCCEEDED','DELIVERY_FAILED') and
        p_summary->>'outcome' in ('DELIVERED','FAILED') and
        p_summary->>'transitionHash' ~ '^[a-f0-9]{64}$' and
        not (p_summary ? 'stage') and not (p_summary ? 'completionHash'))
       or
       (p_summary->>'status' = 'TRUSTED_TERMINAL_DELIVERY_BLOCKED' and
        p_summary->'outcome' = 'null'::jsonb and
        p_summary->>'stage' in ('COMPLETION_DENIED','TRANSITION_DENIED','TERMINAL_CHAIN_EXCEPTION') and
        (not (p_summary ? 'completionHash') or p_summary->>'completionHash' ~ '^[a-f0-9]{64}$') and
        not (p_summary ? 'terminalState') and not (p_summary ? 'transitionHash'))
     ) then
    return false;
  end if;

  update public.terminal_delivery_idempotency
     set status = 'SETTLED', summary = p_summary, settled_at = clock_timestamp()
   where claim_key = p_claim_key and lease_token = p_lease_token
     and status = 'CLAIMED' and lease_expires_at > clock_timestamp();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.claim_terminal_delivery(text, integer) from public, anon, authenticated;
revoke all on function public.settle_terminal_delivery(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_terminal_delivery(text, integer) to service_role;
grant execute on function public.settle_terminal_delivery(text, uuid, jsonb) to service_role;

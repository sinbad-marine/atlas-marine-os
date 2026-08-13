begin;

create table if not exists public.terminal_rollout_activation_journal (
  attestation_hash text primary key check (attestation_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'PENDING' check (status in ('PENDING','APPLIED','REJECTED','UNKNOWN')),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (updated_at >= started_at)
);

alter table public.terminal_rollout_activation_journal enable row level security;
revoke all on public.terminal_rollout_activation_journal from public, anon, authenticated;

create or replace function public.begin_terminal_rollout_activation(p_attestation_hash text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_inserted integer;
begin
  if auth.role()<>'service_role' or p_attestation_hash is null or p_attestation_hash !~ '^[a-f0-9]{64}$' then return 'DENIED'; end if;
  insert into public.terminal_rollout_activation_journal(attestation_hash) values(p_attestation_hash)
  on conflict (attestation_hash) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=1 then return 'BEGUN'; end if;
  return 'EXISTS';
end;
$$;

create or replace function public.settle_terminal_rollout_activation(p_attestation_hash text,p_expected_status text,p_status text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_updated integer;
begin
  if auth.role()<>'service_role' or p_attestation_hash is null or p_attestation_hash !~ '^[a-f0-9]{64}$'
    or p_expected_status not in ('PENDING','UNKNOWN') or p_status not in ('APPLIED','REJECTED','UNKNOWN')
    or (p_expected_status='UNKNOWN' and p_status='UNKNOWN') then return 'DENIED'; end if;
  update public.terminal_rollout_activation_journal set status=p_status,updated_at=clock_timestamp()
  where attestation_hash=p_attestation_hash and status=p_expected_status;
  get diagnostics v_updated = row_count;
  if v_updated=1 then return 'SETTLED'; end if;
  if exists(select 1 from public.terminal_rollout_activation_journal where attestation_hash=p_attestation_hash and status=p_status) then return 'ALREADY_SETTLED'; end if;
  return 'CONFLICT';
end;
$$;

create or replace function public.inspect_terminal_rollout_activation(p_attestation_hash text)
returns table(status text,started_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if p_attestation_hash is null or p_attestation_hash !~ '^[a-f0-9]{64}$' then return; end if;
  return query select j.status,j.started_at,j.updated_at from public.terminal_rollout_activation_journal j where j.attestation_hash=p_attestation_hash;
end;
$$;

revoke all on function public.begin_terminal_rollout_activation(text) from public, anon, authenticated;
revoke all on function public.settle_terminal_rollout_activation(text,text,text) from public, anon, authenticated;
revoke all on function public.inspect_terminal_rollout_activation(text) from public, anon, authenticated;
grant execute on function public.begin_terminal_rollout_activation(text) to service_role;
grant execute on function public.settle_terminal_rollout_activation(text,text,text) to service_role;
grant execute on function public.inspect_terminal_rollout_activation(text) to service_role;

commit;

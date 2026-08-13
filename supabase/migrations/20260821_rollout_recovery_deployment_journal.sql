begin;

create table if not exists public.rollout_recovery_deployment_journal (
  authorization_hash text primary key check (authorization_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'PENDING' check (status in ('PENDING','APPLIED','REJECTED','UNKNOWN')),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (updated_at >= started_at)
);

alter table public.rollout_recovery_deployment_journal enable row level security;
revoke all on public.rollout_recovery_deployment_journal from public, anon, authenticated;

drop function if exists public.begin_rollout_recovery_deployment(text);
create function public.begin_rollout_recovery_deployment(p_authorization_hash text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_inserted integer;
begin
  if auth.role()<>'service_role' or p_authorization_hash is null or p_authorization_hash !~ '^[a-f0-9]{64}$' then return 'DENIED'; end if;
  insert into public.rollout_recovery_deployment_journal(authorization_hash) values(p_authorization_hash)
  on conflict (authorization_hash) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=1 then return 'BEGUN'; end if;
  return 'EXISTS';
end;
$$;

drop function if exists public.settle_rollout_recovery_deployment(text,text,text);
create function public.settle_rollout_recovery_deployment(p_authorization_hash text,p_expected_status text,p_status text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_updated integer;
begin
  if auth.role()<>'service_role' or p_authorization_hash is null or p_authorization_hash !~ '^[a-f0-9]{64}$'
    or p_expected_status not in ('PENDING','UNKNOWN') or p_status not in ('APPLIED','REJECTED','UNKNOWN')
    or (p_expected_status='UNKNOWN' and p_status='UNKNOWN') then return 'DENIED'; end if;
  update public.rollout_recovery_deployment_journal set status=p_status,updated_at=clock_timestamp()
  where authorization_hash=p_authorization_hash and status=p_expected_status;
  get diagnostics v_updated = row_count;
  if v_updated=1 then return 'SETTLED'; end if;
  if exists(select 1 from public.rollout_recovery_deployment_journal where authorization_hash=p_authorization_hash and status=p_status) then return 'ALREADY_SETTLED'; end if;
  return 'CONFLICT';
end;
$$;

drop function if exists public.inspect_rollout_recovery_deployment(text);
create function public.inspect_rollout_recovery_deployment(p_authorization_hash text)
returns table(status text,started_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if p_authorization_hash is null or p_authorization_hash !~ '^[a-f0-9]{64}$' then return; end if;
  return query select j.status,j.started_at,j.updated_at from public.rollout_recovery_deployment_journal j where j.authorization_hash=p_authorization_hash;
end;
$$;

revoke all on function public.begin_rollout_recovery_deployment(text) from public, anon, authenticated;
revoke all on function public.settle_rollout_recovery_deployment(text,text,text) from public, anon, authenticated;
revoke all on function public.inspect_rollout_recovery_deployment(text) from public, anon, authenticated;
grant execute on function public.begin_rollout_recovery_deployment(text) to service_role;
grant execute on function public.settle_rollout_recovery_deployment(text,text,text) to service_role;
grant execute on function public.inspect_rollout_recovery_deployment(text) to service_role;

commit;

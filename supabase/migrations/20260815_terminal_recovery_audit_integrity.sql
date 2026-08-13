begin;

create extension if not exists pgcrypto;

do $$
begin
  if exists(select claim_key from public.terminal_delivery_recovery_audit group by claim_key having count(*)>1) then
    raise exception 'duplicate terminal recovery audit claim keys require operator reconciliation';
  end if;
end $$;

alter table public.terminal_delivery_recovery_audit
  add column if not exists event_time_ms bigint,
  add column if not exists event_hash text;

update public.terminal_delivery_recovery_audit
set event_time_ms = floor(extract(epoch from created_at) * 1000)::bigint
where event_time_ms is null;

update public.terminal_delivery_recovery_audit
set event_hash = encode(digest(convert_to(
  'sinbad-terminal-recovery-audit/3D-v2' || chr(10) || id::text || chr(10) ||
  event_time_ms::text || chr(10) || claim_key || chr(10) || actor_hash || chr(10) ||
  action || chr(10) || reason_code, 'UTF8'), 'sha256'), 'hex')
where event_hash is null;

alter table public.terminal_delivery_recovery_audit
  alter column event_time_ms set not null,
  alter column event_hash set not null,
  add constraint terminal_delivery_recovery_audit_event_hash_check check (event_hash ~ '^[a-f0-9]{64}$'),
  add constraint terminal_delivery_recovery_audit_event_time_check check (event_time_ms > 0),
  add constraint terminal_delivery_recovery_audit_claim_key_unique unique (claim_key);

create or replace function public.seal_terminal_recovery_audit_insert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_expected text;
begin
  if new.event_time_ms is null then new.event_time_ms := floor(extract(epoch from new.created_at) * 1000)::bigint; end if;
  v_expected := encode(digest(convert_to(
    'sinbad-terminal-recovery-audit/3D-v2' || chr(10) || new.id::text || chr(10) ||
    new.event_time_ms::text || chr(10) || new.claim_key || chr(10) || new.actor_hash || chr(10) ||
    new.action || chr(10) || new.reason_code, 'UTF8'), 'sha256'), 'hex');
  if new.event_hash is not null and new.event_hash <> v_expected then raise exception 'terminal recovery audit hash mismatch'; end if;
  new.event_hash := v_expected; return new;
end;
$$;

create or replace function public.reject_terminal_recovery_audit_mutation()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin raise exception 'terminal recovery audit rows are immutable'; end;
$$;

drop trigger if exists terminal_recovery_audit_seal on public.terminal_delivery_recovery_audit;
create trigger terminal_recovery_audit_seal before insert on public.terminal_delivery_recovery_audit
for each row execute function public.seal_terminal_recovery_audit_insert();
drop trigger if exists terminal_recovery_audit_immutable on public.terminal_delivery_recovery_audit;
create trigger terminal_recovery_audit_immutable before update or delete on public.terminal_delivery_recovery_audit
for each row execute function public.reject_terminal_recovery_audit_mutation();
drop trigger if exists terminal_recovery_audit_no_truncate on public.terminal_delivery_recovery_audit;
create trigger terminal_recovery_audit_no_truncate before truncate on public.terminal_delivery_recovery_audit
for each statement execute function public.reject_terminal_recovery_audit_mutation();

create or replace function public.quarantine_expired_terminal_delivery_claim(p_claim_key text, p_actor_hash text, p_reason_code text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_updated integer;
begin
  if p_claim_key is null or p_claim_key !~ '^[a-f0-9]{64}$' or p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' or p_reason_code not in ('PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED') then return false; end if;
  update public.terminal_delivery_idempotency set status='QUARANTINED',summary=jsonb_build_object('status','TRUSTED_TERMINAL_DELIVERY_BLOCKED','outcome',null,'stage','OPERATOR_QUARANTINED'),settled_at=clock_timestamp()
  where claim_key=p_claim_key and status='CLAIMED' and lease_expires_at<=clock_timestamp();
  get diagnostics v_updated = row_count; if v_updated<>1 then return false; end if;
  insert into public.terminal_delivery_recovery_audit(claim_key,actor_hash,action,reason_code)
  values(p_claim_key,p_actor_hash,'OPERATOR_QUARANTINED',p_reason_code);
  return true;
end;
$$;

create or replace function public.list_terminal_recovery_audit(p_limit integer default 100, p_before_id bigint default null)
returns table(id bigint, event_time_ms bigint, claim_key text, actor_hash text, action text, reason_code text, created_at timestamptz, event_hash text)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  return query select a.id,a.event_time_ms,a.claim_key,a.actor_hash,a.action,a.reason_code,a.created_at,a.event_hash
  from public.terminal_delivery_recovery_audit a where p_before_id is null or a.id<p_before_id
  order by a.id desc limit least(greatest(coalesce(p_limit,100),1),500);
end;
$$;

create or replace function public.verify_terminal_recovery_audit_access()
returns boolean language sql security definer set search_path = pg_catalog, public as $$
  select auth.role()='service_role' and to_regclass('public.terminal_delivery_recovery_audit') is not null
    and to_regprocedure('public.list_terminal_recovery_audit(integer,bigint)') is not null
$$;

revoke all on function public.seal_terminal_recovery_audit_insert() from public, anon, authenticated;
revoke all on function public.reject_terminal_recovery_audit_mutation() from public, anon, authenticated;
revoke all on function public.list_terminal_recovery_audit(integer,bigint) from public, anon, authenticated;
revoke all on function public.verify_terminal_recovery_audit_access() from public, anon, authenticated;
revoke all on function public.quarantine_expired_terminal_delivery_claim(text,text,text) from public, anon, authenticated;
grant execute on function public.list_terminal_recovery_audit(integer,bigint) to service_role;
grant execute on function public.verify_terminal_recovery_audit_access() to service_role;
grant execute on function public.quarantine_expired_terminal_delivery_claim(text,text,text) to service_role;

commit;

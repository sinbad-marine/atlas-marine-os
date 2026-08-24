begin;

create or replace function public.list_rollout_recovery_authorization_audit(p_limit integer default 100,p_before_id bigint default null)
returns table(id bigint,actor_hash text,attestation_hash text,purpose_hash text,decision text,decided_at_ms bigint,event_hash text)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  return query select a.id,a.actor_hash,a.attestation_hash,a.purpose_hash,a.decision,a.decided_at_ms,a.event_hash
  from public.rollout_recovery_authorization_audit a where p_before_id is null or a.id<p_before_id
  order by a.id desc limit least(greatest(coalesce(p_limit,100),1),500);
end;
$$;

create or replace function public.verify_rollout_recovery_authorization_audit_access()
returns boolean language sql security definer set search_path = pg_catalog, public as $$
  select auth.role()='service_role' and to_regclass('public.rollout_recovery_authorization_audit') is not null
    and to_regprocedure('public.list_rollout_recovery_authorization_audit(integer,bigint)') is not null
$$;

revoke all on function public.list_rollout_recovery_authorization_audit(integer,bigint) from public, anon, authenticated;
revoke all on function public.verify_rollout_recovery_authorization_audit_access() from public, anon, authenticated;
grant execute on function public.list_rollout_recovery_authorization_audit(integer,bigint) to service_role;
grant execute on function public.verify_rollout_recovery_authorization_audit_access() to service_role;

commit;

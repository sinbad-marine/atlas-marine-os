begin;
create or replace function public.verify_rollout_recovery_runtime_access()
returns boolean language sql security definer set search_path = pg_catalog, public as $$
  select auth.role()='service_role'
    and to_regclass('public.terminal_rollout_activation_journal') is not null
    and to_regclass('public.rollout_recovery_authorization_audit') is not null
    and to_regprocedure('public.begin_terminal_rollout_activation(text)') is not null
    and to_regprocedure('public.settle_terminal_rollout_activation(text,text,text)') is not null
    and to_regprocedure('public.inspect_terminal_rollout_activation(text)') is not null
    and to_regprocedure('public.append_rollout_recovery_authorization_audit(text,text,text,text,bigint,text)') is not null
    and to_regprocedure('public.list_rollout_recovery_authorization_audit(integer,bigint)') is not null
    and to_regprocedure('public.verify_rollout_recovery_authorization_audit_access()') is not null
$$;
revoke all on function public.verify_rollout_recovery_runtime_access() from public, anon, authenticated;
grant execute on function public.verify_rollout_recovery_runtime_access() to service_role;
commit;

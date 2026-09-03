-- Source-only preparation. Apply through the reviewed Supabase migration path.
-- The trusted Edge caller must first verify the exact request JWT and AAL2.
-- One RPC transaction creates both records; audit failure rolls back the grant.
create or replace function public.issue_founder_step_up(
  p_principal_user_id uuid,
  p_workspace_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_command_hash text,
  p_nonce_hash text,
  p_auth_session_id text
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_issued_at timestamptz;
  v_expires_at timestamptz;
begin
  -- Hold the principal row until issuance commits, preventing a suspension
  -- from racing between the active check and the grant/audit inserts.
  perform 1 from public.founder_principals f
   where f.user_id = p_principal_user_id and f.status = 'active'
   for share;
  if not found then raise exception 'ACTIVE_FOUNDER_REQUIRED'; end if;
  if p_action is null or p_action !~ '^(security|identity|core|release|delete)\.' then
    raise exception 'CLASSIFIED_ACTION_REQUIRED';
  end if;

  v_issued_at := clock_timestamp();
  v_expires_at := v_issued_at + interval '5 minutes';
  insert into public.founder_step_up_authorizations as a (
    principal_user_id, workspace_id, action, resource_type, resource_id,
    command_hash, nonce_hash, auth_session_id, issued_at, expires_at
  ) values (
    p_principal_user_id, p_workspace_id, p_action, p_resource_type, p_resource_id,
    p_command_hash, p_nonce_hash, p_auth_session_id, v_issued_at, v_expires_at
  ) returning a.id into v_id;

  insert into public.founder_security_audit (
    principal_user_id, authorization_id, event_type, action,
    resource_type, resource_id, command_hash
  ) values (
    p_principal_user_id, v_id, 'step_up_issued', p_action,
    p_resource_type, p_resource_id, p_command_hash
  );
  return query select v_id, v_expires_at;
end $$;

revoke all on function public.issue_founder_step_up(uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.issue_founder_step_up(uuid,uuid,text,text,text,text,text,text) to service_role;

comment on function public.issue_founder_step_up(uuid,uuid,text,text,text,text,text,text) is
  'Service-only grant and audit transaction. Database-clock five-minute expiry. Caller must independently verify request JWT and current AAL2.';

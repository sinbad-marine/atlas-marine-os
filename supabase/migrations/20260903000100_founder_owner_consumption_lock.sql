-- Serialize consumption against principal suspension, using the same row-lock
-- order as issuance: principal first, then grant. No live migration is implied.
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
  perform 1 from public.founder_principals f
   where f.user_id = p_principal_user_id and f.status = 'active'
   for share;
  if not found then return false; end if;

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
comment on function public.consume_founder_step_up(uuid,uuid,uuid,text,text,text,text,text,text) is
  'Service-only atomic consumption and audit, serialized with principal suspension. Caller must first verify the exact request JWT and current AAL2.';

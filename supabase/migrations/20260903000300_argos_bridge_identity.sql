-- Bridge credentials are random instance credentials, never service-role keys.
create table if not exists public.argos_bridge_instances (
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 owner_user_id uuid not null references auth.users(id),
 credential_hash text not null check (credential_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now()
);
alter table public.argos_bridge_instances enable row level security;
revoke all on public.argos_bridge_instances from anon, authenticated;
grant all on public.argos_bridge_instances to service_role;
grant select on public.founder_principals to service_role;

create or replace function public.consume_argos_bridge_step_up(
 p_instance_id uuid,p_credential_hash text,p_authorization_id uuid,
 p_principal_user_id uuid,p_workspace_id uuid,p_action text,
 p_command_hash text,p_nonce_hash text,p_auth_session_id text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if p_action not in ('core.bridge.library_write','core.bridge.library_index_write','core.bridge.route_write','core.bridge.physical_handoff') then return false; end if;
 perform 1 from public.argos_bridge_instances
 where id=p_instance_id and workspace_id=p_workspace_id and owner_user_id=p_principal_user_id
 and credential_hash=p_credential_hash and status='active' for share;
 if not found then return false; end if;
 perform 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_principal_user_id and role='owner' and is_active=true for share;
 if not found then return false; end if;
 return public.consume_founder_step_up(p_authorization_id,p_principal_user_id,p_workspace_id,p_action,'bridge_instance',p_instance_id::text,p_command_hash,p_nonce_hash,p_auth_session_id);
end;
$$;
revoke all on function public.consume_argos_bridge_step_up(uuid,text,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.consume_argos_bridge_step_up(uuid,text,uuid,uuid,uuid,text,text,text,text) to service_role;

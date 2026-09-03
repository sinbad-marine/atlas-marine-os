-- Appended inside the isolated Owner fixture transaction, before rollback.
create table public.workspace_members(workspace_id uuid,user_id uuid,role text,is_active boolean);
\ir ../../supabase/migrations/20260903000300_argos_bridge_identity.sql
insert into public.workspaces values ('22222222-2222-4222-8222-222222222222');
update public.founder_principals set status='active';
insert into public.workspace_members values ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','owner',true);
insert into public.argos_bridge_instances(id,workspace_id,owner_user_id,credential_hash)
values ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',repeat('c',64));
do $$
declare approval uuid; allowed boolean; variant integer;
begin
 if has_function_privilege('authenticated','public.consume_argos_bridge_step_up(uuid,text,uuid,uuid,uuid,text,text,text,text)','EXECUTE')
 or has_table_privilege('authenticated','public.argos_bridge_instances','SELECT') then raise exception 'BRIDGE_ACL_INVALID'; end if;
 select id into approval from public.issue_founder_step_up('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','core.bridge.route_write','bridge_instance','33333333-3333-4333-8333-333333333333',repeat('d',64),repeat('e',64),'bridge-session');
 for variant in 1..6 loop
  if variant=5 then update public.argos_bridge_instances set status='suspended'; end if;
  if variant=6 then update public.argos_bridge_instances set status='active'; update public.workspace_members set is_active=false; end if;
  select public.consume_argos_bridge_step_up('33333333-3333-4333-8333-333333333333',case when variant=1 then repeat('b',64) else repeat('c',64) end,approval,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','core.bridge.route_write',case when variant=2 then repeat('b',64) else repeat('d',64) end,case when variant=3 then repeat('b',64) else repeat('e',64) end,case when variant=4 then 'wrong-session' else 'bridge-session' end) into allowed;
  if allowed then raise exception 'INVALID_BRIDGE_APPROVAL_ACCEPTED variant %',variant; end if;
 end loop;
 update public.workspace_members set is_active=true;
 select public.consume_argos_bridge_step_up('33333333-3333-4333-8333-333333333333',repeat('c',64),approval,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','core.bridge.route_write',repeat('d',64),repeat('e',64),'bridge-session') into allowed;
 if not allowed then raise exception 'VALID_BRIDGE_APPROVAL_REJECTED'; end if;
 if public.consume_argos_bridge_step_up('33333333-3333-4333-8333-333333333333',repeat('c',64),approval,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','core.bridge.route_write',repeat('d',64),repeat('e',64),'bridge-session') then raise exception 'BRIDGE_REPLAY_ACCEPTED'; end if;
end $$;

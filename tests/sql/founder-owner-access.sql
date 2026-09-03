-- Run only inside the native runner's disposable fixture, after its concurrency
-- checks. auth.uid below models a gateway-supplied identity, NOT JWT verification.
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.founder_principals) <> 1
     or (select count(*) from public.founder_step_up_authorizations) = 0
     or (select count(*) from public.founder_security_audit) = 0 then
    raise exception 'FOUNDER_CANNOT_READ_OWN_RECORDS';
  end if;
  begin
    perform * from public.issue_founder_step_up(
      '11111111-1111-4111-8111-111111111111',null,'identity.member.set_role',
      'workspace_member','fixture',repeat('a',64),repeat('f',64),'test-session');
    raise exception 'AUTHENTICATED_CAN_ISSUE';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_founder_step_up(
      '00000000-0000-4000-8000-000000000000','11111111-1111-4111-8111-111111111111',
      null,'identity.member.set_role','workspace_member','fixture',repeat('a',64),repeat('b',64),'test-session');
    raise exception 'AUTHENTICATED_CAN_CONSUME';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.founder_principals(user_id) values ('22222222-2222-4222-8222-222222222222');
    raise exception 'AUTHENTICATED_CAN_SEED_PRINCIPAL';
  exception when insufficient_privilege then null; end;
  begin
    update public.founder_step_up_authorizations set consumed_at=null,consumed_by=null;
    raise exception 'AUTHENTICATED_CAN_RESET_GRANT';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.founder_security_audit(event_type) values ('step_up_denied');
    raise exception 'AUTHENTICATED_CAN_FORGE_AUDIT';
  exception when insufficient_privilege then null; end;
  begin
    update public.founder_security_audit set event_type='step_up_denied';
    raise exception 'AUTHENTICATED_CAN_UPDATE_AUDIT';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.founder_security_audit;
    raise exception 'AUTHENTICATED_CAN_DELETE_AUDIT';
  exception when insufficient_privilege then null; end;
  begin
    truncate public.founder_security_audit;
    raise exception 'AUTHENTICATED_CAN_TRUNCATE_AUDIT';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if exists(select 1 from public.founder_principals)
     or exists(select 1 from public.founder_step_up_authorizations)
     or exists(select 1 from public.founder_security_audit) then
    raise exception 'OTHER_USER_CAN_READ_FOUNDER_RECORDS';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if exists(select 1 from public.founder_principals)
     or exists(select 1 from public.founder_step_up_authorizations)
     or exists(select 1 from public.founder_security_audit) then
    raise exception 'MISSING_IDENTITY_CAN_READ_FOUNDER_RECORDS';
  end if;
end $$;

set local role anon;
do $$
declare table_name text;
begin
  foreach table_name in array array['founder_principals','founder_step_up_authorizations','founder_security_audit'] loop
    begin
      execute format('select * from public.%I', table_name);
      raise exception 'ANON_CAN_READ_FOUNDER_RECORDS';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform * from public.issue_founder_step_up(
      '11111111-1111-4111-8111-111111111111',null,'identity.member.set_role',
      'workspace_member','fixture',repeat('a',64),repeat('f',64),'test-session');
    raise exception 'ANON_CAN_ISSUE';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_founder_step_up(
      '00000000-0000-4000-8000-000000000000','11111111-1111-4111-8111-111111111111',
      null,'identity.member.set_role','workspace_member','fixture',repeat('a',64),repeat('b',64),'test-session');
    raise exception 'ANON_CAN_CONSUME';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  begin
    update public.founder_security_audit set event_type='step_up_denied';
    raise exception 'AUDIT_OWNER_UPDATE_NOT_REJECTED';
  exception when raise_exception then
    if sqlerrm <> 'Founder security audit is append-only' then raise; end if;
  end;
  begin
    delete from public.founder_security_audit;
    raise exception 'AUDIT_OWNER_DELETE_NOT_REJECTED';
  exception when raise_exception then
    if sqlerrm <> 'Founder security audit is append-only' then raise; end if;
  end;
end $$;
rollback;

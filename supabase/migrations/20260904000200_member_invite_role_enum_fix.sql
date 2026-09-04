begin;

create or replace function public.accept_sinbad_workspace_invite()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.workspace_members(workspace_id,user_id,role,is_active)
  select i.workspace_id,new.id,i.role::public.workspace_role,true
  from public.workspace_invites i
  where lower(i.email)=lower(new.email)
    and i.status='pending'
  on conflict(workspace_id,user_id)
  do update set role=excluded.role,is_active=true;

  update public.workspace_invites
  set status='accepted',accepted_at=clock_timestamp()
  where lower(email)=lower(new.email)
    and status='pending';

  return new;
end $$;

commit;

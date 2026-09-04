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

drop trigger if exists on_sinbad_invited_user_created on auth.users;
drop trigger if exists on_sinbad_invited_user_confirmed on auth.users;
create trigger on_sinbad_invited_user_confirmed
after insert or update of email_confirmed_at on auth.users
for each row execute function public.accept_sinbad_workspace_invite();

with premature as (
  update public.workspace_invites i
  set status='pending',accepted_at=null
  from auth.users u
  where lower(u.email)=lower(i.email)
    and u.email_confirmed_at is null
    and i.status='accepted'
  returning i.workspace_id,u.id as user_id
)
update public.workspace_members m
set is_active=false
from premature p
where m.workspace_id=p.workspace_id
  and m.user_id=p.user_id;

commit;

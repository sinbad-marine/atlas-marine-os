create table if not exists public.workspace_invites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 email text not null, role text not null default 'visitor', note text, status text not null default 'pending',
 invited_by uuid not null references auth.users(id), created_at timestamptz not null default now(), accepted_at timestamptz,
 unique(workspace_id,email)
);
create table if not exists public.member_admin_audit (
 id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id), action text not null, target_user_id uuid references auth.users(id),
 target_email text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.workspace_invites enable row level security;
alter table public.member_admin_audit enable row level security;
create policy "owners read workspace invites" on public.workspace_invites for select using (exists(select 1 from public.workspace_members m where m.workspace_id=workspace_invites.workspace_id and m.user_id=auth.uid() and m.role='owner' and m.is_active));
create policy "owners read member audit" on public.member_admin_audit for select using (exists(select 1 from public.workspace_members m where m.workspace_id=member_admin_audit.workspace_id and m.user_id=auth.uid() and m.role='owner' and m.is_active));
create or replace function public.accept_sinbad_workspace_invite() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.workspace_members(workspace_id,user_id,role,is_active)
 select i.workspace_id,new.id,i.role,true from public.workspace_invites i where lower(i.email)=lower(new.email) and i.status='pending'
 on conflict(workspace_id,user_id) do update set role=excluded.role,is_active=true;
 update public.workspace_invites set status='accepted',accepted_at=now() where lower(email)=lower(new.email) and status='pending';
 return new;
end $$;
drop trigger if exists on_sinbad_invited_user_created on auth.users;
create trigger on_sinbad_invited_user_created after insert on auth.users for each row execute function public.accept_sinbad_workspace_invite();

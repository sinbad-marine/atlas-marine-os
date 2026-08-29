begin;

alter table public.document_submissions
  add column if not exists developer_review_status text not null default 'pending'
    check (developer_review_status in ('pending','approved','changes_requested')),
  add column if not exists developer_review_note text,
  add column if not exists developer_reviewed_by uuid references auth.users(id),
  add column if not exists developer_reviewed_at timestamptz,
  add column if not exists owner_final_status text not null default 'pending'
    check (owner_final_status in ('pending','approved','rejected')),
  add column if not exists owner_final_note text,
  add column if not exists owner_final_by uuid references auth.users(id),
  add column if not exists owner_final_at timestamptz;

create table if not exists public.design_change_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposed_by uuid not null references auth.users(id),
  target_surface text not null check (target_surface in ('dashboard','captain-sinbad','academy','exam-intelligence','store')),
  title text not null check (char_length(title) between 4 and 140),
  plan text not null check (char_length(plan) between 20 and 5000),
  attachment_submission_ids uuid[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','owner_approved','rejected','implemented','published')),
  owner_note text,
  owner_reviewed_by uuid references auth.users(id),
  owner_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.design_change_proposals
  add column if not exists attachment_submission_ids uuid[] not null default '{}';

create table if not exists public.exam_answer_key_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  question_ref text not null,
  answer_key_hash text not null check (answer_key_hash ~ '^[a-f0-9]{64}$'),
  owner_key_created_by uuid not null references auth.users(id),
  developer_decision text not null default 'pending' check (developer_decision in ('pending','approved','changes_requested')),
  developer_note text,
  developer_reviewed_by uuid references auth.users(id),
  developer_reviewed_at timestamptz,
  owner_final_decision text not null default 'pending' check (owner_final_decision in ('pending','approved','rejected')),
  owner_final_note text,
  owner_final_by uuid references auth.users(id),
  owner_final_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,question_ref,answer_key_hash),
  unique(id,answer_key_hash)
);

-- Secret answer material is deliberately separate from review metadata. It has
-- no client policy: only the service-role Edge Function may read it.
create table if not exists public.exam_answer_key_materials (
  review_id uuid primary key,
  answer_key_hash text not null check (answer_key_hash ~ '^[a-f0-9]{64}$'),
  answer_key jsonb not null check (jsonb_typeof(answer_key)='object'),
  created_at timestamptz not null default now(),
  foreign key(review_id,answer_key_hash) references public.exam_answer_key_reviews(id,answer_key_hash) on delete cascade
);

create table if not exists public.exam_answer_key_review_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.exam_answer_key_reviews(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  actor_role text not null check (actor_role in ('owner','developer')),
  action text not null check (action in ('developer_approved','developer_changes_requested','owner_approved','owner_rejected')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.design_change_proposals enable row level security;
alter table public.exam_answer_key_reviews enable row level security;
alter table public.exam_answer_key_materials enable row level security;
alter table public.exam_answer_key_review_audit enable row level security;

drop policy if exists "contributors read design proposals" on public.design_change_proposals;
create policy "contributors read design proposals" on public.design_change_proposals for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=design_change_proposals.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
drop policy if exists "contributors submit design proposals" on public.design_change_proposals;
create policy "contributors submit design proposals" on public.design_change_proposals for insert
with check (proposed_by=auth.uid() and exists(select 1 from public.workspace_members m where m.workspace_id=design_change_proposals.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
drop policy if exists "reviewers read answer key reviews" on public.exam_answer_key_reviews;
create policy "reviewers read answer key reviews" on public.exam_answer_key_reviews for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=exam_answer_key_reviews.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
drop policy if exists "reviewers read answer review audit" on public.exam_answer_key_review_audit;
create policy "reviewers read answer review audit" on public.exam_answer_key_review_audit for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=exam_answer_key_review_audit.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));

revoke update,delete on public.design_change_proposals from authenticated;
revoke insert,update,delete on public.exam_answer_key_reviews from authenticated;
revoke all on public.exam_answer_key_materials from anon,authenticated;
revoke insert,update,delete on public.exam_answer_key_review_audit from anon,authenticated;

create or replace function public.reject_exam_answer_key_audit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Exam answer-key review audit rows are immutable';
end $$;

drop trigger if exists exam_answer_key_review_audit_immutable on public.exam_answer_key_review_audit;
create trigger exam_answer_key_review_audit_immutable
before update or delete on public.exam_answer_key_review_audit
for each row execute function public.reject_exam_answer_key_audit_mutation();

create or replace function public.exam_developer_decide(p_workspace_id uuid,p_review_id uuid,p_actor_id uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
begin
  if p_decision not in ('approved','changes_requested') then raise exception 'Invalid Developer decision'; end if;
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and m.role='developer') then raise exception 'Active Developer role required'; end if;
  update public.exam_answer_key_reviews set developer_decision=p_decision,developer_note=nullif(left(coalesce(p_note,''),2000),''),developer_reviewed_by=p_actor_id,developer_reviewed_at=now(),owner_final_decision='pending',owner_final_note=null,owner_final_by=null,owner_final_at=null where id=p_review_id and workspace_id=p_workspace_id;
  if not found then raise exception 'Review not found'; end if;
  insert into public.exam_answer_key_review_audit(workspace_id,review_id,actor_id,actor_role,action,note) values(p_workspace_id,p_review_id,p_actor_id,'developer',case when p_decision='approved' then 'developer_approved' else 'developer_changes_requested' end,nullif(left(coalesce(p_note,''),2000),''));
  return case when p_decision='approved' then 'OWNER_FINAL_APPROVAL' else 'DEVELOPER_REVISION' end;
end $$;

create or replace function public.exam_owner_finalize(p_workspace_id uuid,p_review_id uuid,p_actor_id uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare developer_status text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid Owner decision'; end if;
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and m.role='owner') then raise exception 'Active Owner role required'; end if;
  select developer_decision into developer_status from public.exam_answer_key_reviews where id=p_review_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'Review not found'; end if;
  if p_decision='approved' and developer_status<>'approved' then raise exception 'Developer approval is required before Owner final approval'; end if;
  update public.exam_answer_key_reviews set owner_final_decision=p_decision,owner_final_note=nullif(left(coalesce(p_note,''),2000),''),owner_final_by=p_actor_id,owner_final_at=now() where id=p_review_id and workspace_id=p_workspace_id;
  insert into public.exam_answer_key_review_audit(workspace_id,review_id,actor_id,actor_role,action,note) values(p_workspace_id,p_review_id,p_actor_id,'owner',case when p_decision='approved' then 'owner_approved' else 'owner_rejected' end,nullif(left(coalesce(p_note,''),2000),''));
  return case when p_decision='approved' then 'PROTECTED_RELEASE_PIPELINE' else 'NONE' end;
end $$;

revoke all on function public.exam_developer_decide(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.exam_owner_finalize(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.exam_developer_decide(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.exam_owner_finalize(uuid,uuid,uuid,text,text) to service_role;

commit;

begin;

create table if not exists public.human_reviewer_authorizations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  state text not null default 'active' check (state in ('active','suspended','revoked')),
  authorized_by uuid not null references auth.users(id),
  authorized_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(workspace_id,user_id)
);

create table if not exists public.human_review_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_batch_id text not null check (char_length(source_batch_id) between 1 and 200),
  source_revision text not null check (char_length(source_revision) between 1 and 200),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(title) between 1 and 200),
  package_size integer not null check (package_size in (25,50,100,250)),
  expected_count integer not null check (expected_count between 1 and 250),
  present_count integer not null check (present_count between 0 and 250),
  missing_count integer not null check (missing_count between 0 and 250),
  deferred_count integer not null check (deferred_count between 0 and 250),
  package_complete boolean generated always as (expected_count=present_count and missing_count=0 and deferred_count=0) stored,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','ASSIGNED','IN_REVIEW','SUBMITTED_COMPLETE','SUBMITTED_INCOMPLETE','OWNER_ACCEPTED','OWNER_RETURNED','CANCELLED')),
  assigned_reviewer_id uuid references auth.users(id),
  assignment_generation bigint not null default 0 check (assignment_generation>=0),
  lock_version bigint not null default 0 check (lock_version>=0),
  reviewed_count integer not null default 0 check (reviewed_count between 0 and 250),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  assigned_at timestamptz,
  last_activity_at timestamptz,
  submitted_at timestamptz,
  unique(workspace_id,source_batch_id,source_revision,content_sha256),
  check (present_count+missing_count+deferred_count=expected_count),
  check (present_count<=package_size and expected_count<=package_size),
  check ((status='AVAILABLE')=(assigned_reviewer_id is null))
);

create table if not exists public.human_review_package_questions (
  package_id uuid not null references public.human_review_packages(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 200),
  position integer not null check (position between 1 and 250),
  source_revision text not null check (char_length(source_revision) between 1 and 200),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  technical_status text not null check (char_length(technical_status) between 1 and 100),
  question_payload jsonb not null check (jsonb_typeof(question_payload)='object'),
  evidence_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_payload)='object'),
  primary key(package_id,question_id),
  unique(package_id,position)
);

create table if not exists public.human_question_reviews (
  package_id uuid not null,
  question_id text not null,
  reviewer_id uuid not null references auth.users(id),
  human_decision text not null check (human_decision in ('APPROVED','CORRECTION_REQUIRED','SOURCE_HOLD')),
  note text check (note is null or char_length(note)<=2000),
  assignment_generation bigint not null check (assignment_generation>=1),
  revision bigint not null default 1 check (revision>=1),
  reviewed_at timestamptz not null default clock_timestamp(),
  owner_decision text not null default 'PENDING' check (owner_decision in ('PENDING','ACCEPTED','RETURNED')),
  owner_id uuid references auth.users(id),
  owner_note text check (owner_note is null or char_length(owner_note)<=2000),
  owner_reviewed_at timestamptz,
  primary key(package_id,question_id),
  foreign key(package_id,question_id) references public.human_review_package_questions(package_id,question_id) on delete cascade
);

create table if not exists public.human_review_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  package_id uuid references public.human_review_packages(id) on delete cascade,
  question_id text,
  actor_id uuid not null references auth.users(id),
  actor_kind text not null check (actor_kind in ('OWNER','HUMAN_REVIEWER')),
  action text not null check (char_length(action) between 3 and 80),
  previous_state jsonb,
  new_state jsonb,
  note text check (note is null or char_length(note)<=2000),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists human_review_packages_workspace_status_id on public.human_review_packages(workspace_id,status,id);
create index if not exists human_review_packages_assignee_status_id on public.human_review_packages(workspace_id,assigned_reviewer_id,status,id);
create index if not exists human_review_questions_package_position on public.human_review_package_questions(package_id,position);
create index if not exists human_question_reviews_reviewer_time on public.human_question_reviews(reviewer_id,reviewed_at desc);
create index if not exists human_review_audit_package_time on public.human_review_audit(workspace_id,package_id,created_at desc,id desc);
create index if not exists human_review_audit_actor_time on public.human_review_audit(workspace_id,actor_id,created_at desc,id desc);

alter table public.human_reviewer_authorizations enable row level security;
alter table public.human_review_packages enable row level security;
alter table public.human_review_package_questions enable row level security;
alter table public.human_question_reviews enable row level security;
alter table public.human_review_audit enable row level security;
revoke all on public.human_reviewer_authorizations,public.human_review_packages,public.human_review_package_questions,public.human_question_reviews,public.human_review_audit from anon,authenticated;

create or replace function public.reject_human_review_audit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'HUMAN_REVIEW_AUDIT_IMMUTABLE'; end $$;
drop trigger if exists human_review_audit_immutable on public.human_review_audit;
create trigger human_review_audit_immutable before update or delete on public.human_review_audit
for each row execute function public.reject_human_review_audit_mutation();

create or replace function public.human_review_authorize_reviewer(
  p_workspace_id uuid,p_actor_id uuid,p_user_id uuid,p_state text,p_request_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_previous jsonb;v_result jsonb;
begin
  if p_state not in ('active','suspended','revoked') or p_request_id is null then raise exception 'HUMAN_REVIEW_INPUT_INVALID'; end if;
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and m.role::text='owner') then raise exception 'HUMAN_REVIEW_OWNER_REQUIRED'; end if;
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_user_id and m.is_active) then raise exception 'HUMAN_REVIEW_ACTIVE_MEMBER_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':'||p_user_id::text,0));
  select to_jsonb(a) into v_previous from public.human_reviewer_authorizations a where a.workspace_id=p_workspace_id and a.user_id=p_user_id for update;
  select new_state into v_result from public.human_review_audit where request_id=p_request_id and actor_id=p_actor_id;
  if found then return v_result||jsonb_build_object('duplicate',true); end if;
  insert into public.human_reviewer_authorizations(workspace_id,user_id,state,authorized_by)
  values(p_workspace_id,p_user_id,p_state,p_actor_id)
  on conflict(workspace_id,user_id) do update set state=excluded.state,authorized_by=excluded.authorized_by,updated_at=clock_timestamp();
  v_result=jsonb_build_object('workspaceId',p_workspace_id,'userId',p_user_id,'state',p_state,'duplicate',false);
  insert into public.human_review_audit(request_id,workspace_id,actor_id,actor_kind,action,previous_state,new_state,note)
  values(p_request_id,p_workspace_id,p_actor_id,'OWNER','REVIEWER_'||upper(p_state),v_previous,v_result,nullif(left(coalesce(p_note,''),2000),''));
  return v_result;
end $$;

create or replace function public.human_review_claim_package(
  p_workspace_id uuid,p_package_id uuid,p_actor_id uuid,p_expected_lock_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_package public.human_review_packages%rowtype;v_previous jsonb;v_result jsonb;
begin
  select * into v_package from public.human_review_packages where id=p_package_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'HUMAN_REVIEW_PACKAGE_NOT_FOUND'; end if;
  select new_state into v_result from public.human_review_audit where request_id=p_request_id and actor_id=p_actor_id;
  if found then return v_result||jsonb_build_object('duplicate',true); end if;
  if not exists(select 1 from public.workspace_members m join public.human_reviewer_authorizations a on a.workspace_id=m.workspace_id and a.user_id=m.user_id where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and a.state='active') then raise exception 'HUMAN_REVIEW_REVIEWER_REQUIRED'; end if;
  if v_package.status<>'AVAILABLE' or v_package.assigned_reviewer_id is not null then raise exception 'HUMAN_REVIEW_PACKAGE_ALREADY_CLAIMED'; end if;
  if v_package.lock_version<>p_expected_lock_version then raise exception 'HUMAN_REVIEW_STALE_WRITE'; end if;
  v_previous=to_jsonb(v_package);
  update public.human_review_packages set status='IN_REVIEW',assigned_reviewer_id=p_actor_id,assigned_at=clock_timestamp(),last_activity_at=clock_timestamp(),assignment_generation=assignment_generation+1,lock_version=lock_version+1 where id=p_package_id returning * into v_package;
  v_result=jsonb_build_object('packageId',v_package.id,'status',v_package.status,'assignmentGeneration',v_package.assignment_generation,'lockVersion',v_package.lock_version,'duplicate',false);
  insert into public.human_review_audit(request_id,workspace_id,package_id,actor_id,actor_kind,action,previous_state,new_state)
  values(p_request_id,p_workspace_id,p_package_id,p_actor_id,'HUMAN_REVIEWER','PACKAGE_CLAIMED',v_previous,v_result);
  return v_result;
end $$;

create or replace function public.human_review_transfer_package(
  p_workspace_id uuid,p_package_id uuid,p_actor_id uuid,p_target_user_id uuid,p_expected_lock_version bigint,p_request_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_package public.human_review_packages%rowtype;v_previous jsonb;v_result jsonb;
begin
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and m.role::text='owner') then raise exception 'HUMAN_REVIEW_OWNER_REQUIRED'; end if;
  select * into v_package from public.human_review_packages where id=p_package_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'HUMAN_REVIEW_PACKAGE_NOT_FOUND'; end if;
  select new_state into v_result from public.human_review_audit where request_id=p_request_id and actor_id=p_actor_id;
  if found then return v_result||jsonb_build_object('duplicate',true); end if;
  if v_package.lock_version<>p_expected_lock_version then raise exception 'HUMAN_REVIEW_STALE_WRITE'; end if;
  if p_target_user_id is not null and not exists(select 1 from public.workspace_members m join public.human_reviewer_authorizations a on a.workspace_id=m.workspace_id and a.user_id=m.user_id where m.workspace_id=p_workspace_id and m.user_id=p_target_user_id and m.is_active and a.state='active') then raise exception 'HUMAN_REVIEW_TARGET_REVIEWER_INVALID'; end if;
  v_previous=to_jsonb(v_package);
  update public.human_review_packages set assigned_reviewer_id=p_target_user_id,status=case when p_target_user_id is null then 'AVAILABLE' else 'ASSIGNED' end,assigned_at=case when p_target_user_id is null then null else clock_timestamp() end,last_activity_at=clock_timestamp(),submitted_at=null,assignment_generation=assignment_generation+1,lock_version=lock_version+1 where id=p_package_id returning * into v_package;
  v_result=jsonb_build_object('packageId',v_package.id,'status',v_package.status,'assignedReviewerId',v_package.assigned_reviewer_id,'assignmentGeneration',v_package.assignment_generation,'lockVersion',v_package.lock_version,'duplicate',false);
  insert into public.human_review_audit(request_id,workspace_id,package_id,actor_id,actor_kind,action,previous_state,new_state,note)
  values(p_request_id,p_workspace_id,p_package_id,p_actor_id,'OWNER',case when p_target_user_id is null then 'PACKAGE_RECLAIMED' else 'PACKAGE_TRANSFERRED' end,v_previous,v_result,nullif(left(coalesce(p_note,''),2000),''));
  return v_result;
end $$;

create or replace function public.human_review_save_decision(
  p_workspace_id uuid,p_package_id uuid,p_question_id text,p_actor_id uuid,p_decision text,p_note text,p_assignment_generation bigint,p_expected_lock_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_package public.human_review_packages%rowtype;v_previous jsonb;v_result jsonb;v_revision bigint;v_reviewed integer;
begin
  if p_decision not in ('APPROVED','CORRECTION_REQUIRED','SOURCE_HOLD') or char_length(coalesce(p_note,''))>2000 then raise exception 'HUMAN_REVIEW_INPUT_INVALID'; end if;
  select * into v_package from public.human_review_packages where id=p_package_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'HUMAN_REVIEW_PACKAGE_NOT_FOUND'; end if;
  select new_state into v_result from public.human_review_audit where request_id=p_request_id and actor_id=p_actor_id;
  if found then return v_result||jsonb_build_object('duplicate',true); end if;
  if not exists(select 1 from public.workspace_members m join public.human_reviewer_authorizations a on a.workspace_id=m.workspace_id and a.user_id=m.user_id where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and a.state='active') then raise exception 'HUMAN_REVIEW_REVIEWER_REQUIRED'; end if;
  if v_package.assigned_reviewer_id is distinct from p_actor_id or v_package.status not in ('ASSIGNED','IN_REVIEW') then raise exception 'HUMAN_REVIEW_NOT_ASSIGNED'; end if;
  if v_package.assignment_generation<>p_assignment_generation or v_package.lock_version<>p_expected_lock_version then raise exception 'HUMAN_REVIEW_STALE_WRITE'; end if;
  if not exists(select 1 from public.human_review_package_questions q where q.package_id=p_package_id and q.question_id=p_question_id) then raise exception 'HUMAN_REVIEW_QUESTION_NOT_FOUND'; end if;
  select to_jsonb(r) into v_previous from public.human_question_reviews r where r.package_id=p_package_id and r.question_id=p_question_id;
  insert into public.human_question_reviews(package_id,question_id,reviewer_id,human_decision,note,assignment_generation)
  values(p_package_id,p_question_id,p_actor_id,p_decision,nullif(p_note,''),p_assignment_generation)
  on conflict(package_id,question_id) do update set reviewer_id=excluded.reviewer_id,human_decision=excluded.human_decision,note=excluded.note,assignment_generation=excluded.assignment_generation,revision=public.human_question_reviews.revision+1,reviewed_at=clock_timestamp(),owner_decision='PENDING',owner_id=null,owner_note=null,owner_reviewed_at=null
  returning revision into v_revision;
  select count(*)::integer into v_reviewed from public.human_question_reviews where package_id=p_package_id;
  update public.human_review_packages set status='IN_REVIEW',reviewed_count=v_reviewed,last_activity_at=clock_timestamp(),lock_version=lock_version+1 where id=p_package_id returning * into v_package;
  v_result=jsonb_build_object('packageId',p_package_id,'questionId',p_question_id,'decision',p_decision,'reviewRevision',v_revision,'reviewedCount',v_reviewed,'assignmentGeneration',v_package.assignment_generation,'lockVersion',v_package.lock_version,'duplicate',false);
  insert into public.human_review_audit(request_id,workspace_id,package_id,question_id,actor_id,actor_kind,action,previous_state,new_state,note)
  values(p_request_id,p_workspace_id,p_package_id,p_question_id,p_actor_id,'HUMAN_REVIEWER','QUESTION_DECISION_SAVED',v_previous,v_result,nullif(p_note,''));
  return v_result;
end $$;

create or replace function public.human_review_submit_package(
  p_workspace_id uuid,p_package_id uuid,p_actor_id uuid,p_assignment_generation bigint,p_expected_lock_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_package public.human_review_packages%rowtype;v_result jsonb;v_reviewed integer;
begin
  select * into v_package from public.human_review_packages where id=p_package_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'HUMAN_REVIEW_PACKAGE_NOT_FOUND'; end if;
  select new_state into v_result from public.human_review_audit where request_id=p_request_id and actor_id=p_actor_id;
  if found then return v_result||jsonb_build_object('duplicate',true); end if;
  if not exists(select 1 from public.workspace_members m join public.human_reviewer_authorizations a on a.workspace_id=m.workspace_id and a.user_id=m.user_id where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and a.state='active') then raise exception 'HUMAN_REVIEW_REVIEWER_REQUIRED'; end if;
  if v_package.assigned_reviewer_id is distinct from p_actor_id or v_package.status not in ('ASSIGNED','IN_REVIEW') then raise exception 'HUMAN_REVIEW_NOT_ASSIGNED'; end if;
  if v_package.assignment_generation<>p_assignment_generation or v_package.lock_version<>p_expected_lock_version then raise exception 'HUMAN_REVIEW_STALE_WRITE'; end if;
  select count(*)::integer into v_reviewed from public.human_question_reviews where package_id=p_package_id;
  if v_reviewed<>v_package.present_count then raise exception 'HUMAN_REVIEW_QUESTIONS_PENDING'; end if;
  update public.human_review_packages set status=case when package_complete and not exists(select 1 from public.human_question_reviews r where r.package_id=p_package_id and r.human_decision<>'APPROVED') then 'SUBMITTED_COMPLETE' else 'SUBMITTED_INCOMPLETE' end,reviewed_count=v_reviewed,submitted_at=clock_timestamp(),last_activity_at=clock_timestamp(),lock_version=lock_version+1 where id=p_package_id returning * into v_package;
  v_result=jsonb_build_object('packageId',p_package_id,'status',v_package.status,'packageComplete',v_package.package_complete,'reviewedCount',v_reviewed,'assignmentGeneration',v_package.assignment_generation,'lockVersion',v_package.lock_version,'duplicate',false);
  insert into public.human_review_audit(request_id,workspace_id,package_id,actor_id,actor_kind,action,previous_state,new_state)
  values(p_request_id,p_workspace_id,p_package_id,p_actor_id,'HUMAN_REVIEWER','PACKAGE_SUBMITTED',jsonb_build_object('status','IN_REVIEW','lockVersion',p_expected_lock_version),v_result);
  return v_result;
end $$;

revoke all on function public.human_review_authorize_reviewer(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.human_review_claim_package(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.human_review_transfer_package(uuid,uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.human_review_save_decision(uuid,uuid,text,uuid,text,text,bigint,bigint,uuid) from public,anon,authenticated;
revoke all on function public.human_review_submit_package(uuid,uuid,uuid,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.human_review_authorize_reviewer(uuid,uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.human_review_claim_package(uuid,uuid,uuid,bigint,uuid) to service_role;
grant execute on function public.human_review_transfer_package(uuid,uuid,uuid,uuid,bigint,uuid,text) to service_role;
grant execute on function public.human_review_save_decision(uuid,uuid,text,uuid,text,text,bigint,bigint,uuid) to service_role;
grant execute on function public.human_review_submit_package(uuid,uuid,uuid,bigint,bigint,uuid) to service_role;

commit;

begin;

-- Reference list of flag administrations the Academy can teach flag-specific
-- material for. Core IMO/ILO content is flag-agnostic and is recorded with a
-- NULL flag_administration everywhere below, never a sentinel row here.
-- Adding a new flag (Cayman, Marshall Islands, Malta, ...) is a data insert
-- into this table, not a schema or code change.
create table if not exists public.academy_flag_administrations (
  code text primary key check (code ~ '^[A-Z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'planned' check (status in ('active','planned')),
  created_at timestamptz not null default now()
);

insert into public.academy_flag_administrations(code,name,status) values
  ('UK_MCA','United Kingdom Maritime and Coastguard Agency','active'),
  ('CAYMAN','Cayman Islands Shipping Registry','planned'),
  ('MARSHALL_ISLANDS','Republic of the Marshall Islands Maritime Administrator','planned'),
  ('MALTA','Malta Flag Administration','planned')
on conflict (code) do nothing;

alter table public.academy_flag_administrations enable row level security;
drop policy if exists "members read flag administrations" on public.academy_flag_administrations;
create policy "members read flag administrations" on public.academy_flag_administrations for select
using (auth.uid() is not null);
revoke insert,update,delete on public.academy_flag_administrations from anon,authenticated;

-- Verified-source manifest for ISM/ISPS/MLC Academy content. A row with
-- flag_administration NULL is universal IMO/ILO-sourced material; a row with
-- flag_administration set is national law / DMLC Part I / a national
-- circular for that flag state specifically. The two are never merged into
-- one row so provenance and legal weight stay distinguishable in the UI.
create table if not exists public.academy_ism_source_manifest (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id text not null check (char_length(source_id) between 1 and 200),
  title text not null check (char_length(title) between 1 and 300),
  authority text not null check (char_length(authority) between 1 and 200),
  flag_administration text references public.academy_flag_administrations(code),
  module_code text not null check (module_code ~ '^[a-z0-9-]{2,60}$'),
  version text not null check (char_length(version) between 1 and 60),
  section text,
  rights text not null default 'reference-only' check (rights in ('reference-only','public-domain','licensed')),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  -- CANDIDATE_SOURCED = Grok-produced candidate manifest entry.
  -- INDEPENDENTLY_VERIFIED = Gemini cross-verification passed.
  -- MASTER_MANIFEST = promoted into the Master Source Manifest.
  -- HUMAN_REVIEW_ACCEPTED = Owner accepted it via the Human Review package flow.
  -- Only HUMAN_REVIEW_ACCEPTED rows may ever be served to students (see RLS below).
  verification_stage text not null default 'UNVERIFIED_CANDIDATE'
    check (verification_stage in ('UNVERIFIED_CANDIDATE','CANDIDATE_SOURCED','INDEPENDENTLY_VERIFIED','MASTER_MANIFEST','HUMAN_REVIEW_ACCEPTED')),
  review_package_id uuid references public.human_review_packages(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,source_id,version)
);

create table if not exists public.academy_ism_source_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  manifest_id uuid not null references public.academy_ism_source_manifest(id) on delete cascade,
  chunk_index integer not null check (chunk_index>=0),
  text_content text not null check (char_length(text_content) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique(manifest_id,chunk_index)
);

-- One row per work-order question schema field: QUESTION_ID, LEARNING_OBJECTIVE,
-- DIFFICULTY, SOURCE_ID/VERSION/SECTION, EXPECTED_REASONING, MARKING_RUBRIC,
-- PASS_THRESHOLD. competency_dimension is one of the 10 mastery dimensions and
-- is never collapsed into a single score (see academy_ism_mastery below).
create table if not exists public.academy_ism_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 100),
  module_code text not null check (module_code ~ '^[a-z0-9-]{2,60}$'),
  flag_administration text references public.academy_flag_administrations(code),
  learning_objective text not null check (char_length(learning_objective) between 1 and 500),
  difficulty text not null check (difficulty in ('foundation','operational','management','expert')),
  competency_dimension text not null check (competency_dimension in (
    'ism_knowledge','dpa_competence','isps_knowledge','cso_competence','mlc_knowledge',
    'audit_competence','root_cause_capa','flag_ro_understanding','yacht_application','professional_judgement'
  )),
  source_manifest_id uuid not null references public.academy_ism_source_manifest(id),
  source_version text not null check (char_length(source_version) between 1 and 60),
  source_section text,
  question_kind text not null check (question_kind in (
    'multiple_choice','multiple_response','true_false_justify','short_answer','long_answer',
    'document_interpretation','evidence_assessment','scenario_decision',
    'audit_finding_classification','root_cause_analysis','capa_design','oral'
  )),
  prompt text not null check (char_length(prompt) between 1 and 5000),
  choices jsonb,
  correct_answer jsonb not null,
  expected_reasoning text,
  marking_rubric jsonb not null,
  pass_threshold numeric not null check (pass_threshold between 0 and 1),
  verification_stage text not null default 'UNVERIFIED_CANDIDATE'
    check (verification_stage in ('UNVERIFIED_CANDIDATE','CANDIDATE_SOURCED','INDEPENDENTLY_VERIFIED','MASTER_MANIFEST','HUMAN_REVIEW_ACCEPTED')),
  review_package_id uuid references public.human_review_packages(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,question_id)
);

-- Per-user, private attempt log. Never readable by other workspace members,
-- including Owner/developer, matching the work order's privacy requirement.
create table if not exists public.academy_ism_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  question_id uuid not null references public.academy_ism_questions(id),
  response jsonb not null,
  is_correct boolean,
  score numeric check (score between 0 and 1),
  reasoning_notes text,
  attempted_at timestamptz not null default now()
);

-- Per-user mastery, tracked separately per competency dimension and,
-- independently, per flag administration (flag_administration is NULL for
-- the 9 flag-agnostic dimensions and set only where flag-specific mastery,
-- e.g. flag_ro_understanding for a specific flag, is being tracked).
-- Never written directly by clients: computed server-side only (Phase 4).
create table if not exists public.academy_ism_mastery (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  competency_dimension text not null check (competency_dimension in (
    'ism_knowledge','dpa_competence','isps_knowledge','cso_competence','mlc_knowledge',
    'audit_competence','root_cause_capa','flag_ro_understanding','yacht_application','professional_judgement'
  )),
  flag_administration text references public.academy_flag_administrations(code),
  mastery_level text not null default 'NOT_ASSESSED' check (mastery_level in ('NOT_ASSESSED','NOT_READY','DEVELOPING','NEAR_READY','READY')),
  attempts_count integer not null default 0 check (attempts_count>=0),
  correct_count integer not null default 0 check (correct_count>=0),
  updated_at timestamptz not null default now()
);

-- Postgres cannot express NULL-inclusive uniqueness in a plain unique
-- constraint, so the "one core row + one row per flag" invariant is enforced
-- with a pair of partial unique indexes instead of a composite primary key.
create unique index if not exists academy_ism_mastery_unique_core
  on public.academy_ism_mastery(workspace_id,user_id,competency_dimension)
  where flag_administration is null;
create unique index if not exists academy_ism_mastery_unique_flagged
  on public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration)
  where flag_administration is not null;

-- Readiness is a computed projection over mastery + simulator/exam results
-- (Phase 8). The table exists now so later phases have somewhere tamper-proof
-- to write; no computation logic ships in this migration.
create table if not exists public.academy_ism_readiness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  competency_dimension text not null check (competency_dimension in (
    'ism_knowledge','dpa_competence','isps_knowledge','cso_competence','mlc_knowledge',
    'audit_competence','root_cause_capa','flag_ro_understanding','yacht_application','professional_judgement'
  )),
  flag_administration text references public.academy_flag_administrations(code),
  readiness_state text not null default 'NOT_READY' check (readiness_state in ('NOT_READY','DEVELOPING','NEAR_READY','READY')),
  computed_at timestamptz not null default now()
);

create unique index if not exists academy_ism_readiness_unique_core
  on public.academy_ism_readiness(workspace_id,user_id,competency_dimension)
  where flag_administration is null;
create unique index if not exists academy_ism_readiness_unique_flagged
  on public.academy_ism_readiness(workspace_id,user_id,competency_dimension,flag_administration)
  where flag_administration is not null;

alter table public.academy_ism_source_manifest enable row level security;
alter table public.academy_ism_source_chunks enable row level security;
alter table public.academy_ism_questions enable row level security;
alter table public.academy_ism_attempts enable row level security;
alter table public.academy_ism_mastery enable row level security;
alter table public.academy_ism_readiness enable row level security;

drop policy if exists "members read accepted source manifest" on public.academy_ism_source_manifest;
create policy "members read accepted source manifest" on public.academy_ism_source_manifest for select
using (
  verification_stage='HUMAN_REVIEW_ACCEPTED'
  and exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_source_manifest.workspace_id and m.user_id=auth.uid() and m.is_active)
);
drop policy if exists "reviewers read all source manifest stages" on public.academy_ism_source_manifest;
create policy "reviewers read all source manifest stages" on public.academy_ism_source_manifest for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_source_manifest.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
revoke insert,update,delete on public.academy_ism_source_manifest from anon,authenticated;

drop policy if exists "members read accepted source chunks" on public.academy_ism_source_chunks;
create policy "members read accepted source chunks" on public.academy_ism_source_chunks for select
using (exists(
  select 1 from public.academy_ism_source_manifest sm
  join public.workspace_members m on m.workspace_id=sm.workspace_id
  where sm.id=academy_ism_source_chunks.manifest_id and sm.verification_stage='HUMAN_REVIEW_ACCEPTED' and m.user_id=auth.uid() and m.is_active
));
drop policy if exists "reviewers read all source chunks" on public.academy_ism_source_chunks;
create policy "reviewers read all source chunks" on public.academy_ism_source_chunks for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_source_chunks.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
revoke insert,update,delete on public.academy_ism_source_chunks from anon,authenticated;

-- This policy is the Critical Rule's database-level gate: a student can never
-- read a question whose regulatory content has not cleared Human Review
-- acceptance, regardless of what the application layer does or forgets to do.
drop policy if exists "members read accepted questions" on public.academy_ism_questions;
create policy "members read accepted questions" on public.academy_ism_questions for select
using (
  verification_stage='HUMAN_REVIEW_ACCEPTED'
  and exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_questions.workspace_id and m.user_id=auth.uid() and m.is_active)
);
drop policy if exists "reviewers read all question stages" on public.academy_ism_questions;
create policy "reviewers read all question stages" on public.academy_ism_questions for select
using (exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_questions.workspace_id and m.user_id=auth.uid() and m.is_active and m.role in ('owner','developer')));
revoke insert,update,delete on public.academy_ism_questions from anon,authenticated;

drop policy if exists "users read own attempts" on public.academy_ism_attempts;
create policy "users read own attempts" on public.academy_ism_attempts for select
using (user_id=auth.uid());
drop policy if exists "users record own attempts" on public.academy_ism_attempts;
create policy "users record own attempts" on public.academy_ism_attempts for insert
with check (
  user_id=auth.uid()
  and exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_attempts.workspace_id and m.user_id=auth.uid() and m.is_active)
);
revoke update,delete on public.academy_ism_attempts from anon,authenticated;

drop policy if exists "users read own mastery" on public.academy_ism_mastery;
create policy "users read own mastery" on public.academy_ism_mastery for select
using (user_id=auth.uid());
revoke insert,update,delete on public.academy_ism_mastery from anon,authenticated;

drop policy if exists "users read own readiness" on public.academy_ism_readiness;
create policy "users read own readiness" on public.academy_ism_readiness for select
using (user_id=auth.uid());
revoke insert,update,delete on public.academy_ism_readiness from anon,authenticated;

commit;

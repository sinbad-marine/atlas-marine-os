-- Owner-private Academy training path (pilot scope: the Owner studies and answers
-- questions that are TECHNICALLY_VERIFIED in a Human Review package, without the
-- Human Review governance path being rewritten or short-circuited).
--
-- Separation of concepts (Owner directive 2026-09-14):
--   CONTENT GOVERNANCE  -> verification_stage (unchanged meaning; HUMAN_REVIEW_ACCEPTED
--                          still means real Human Review + Owner governance occurred)
--   TRAINING ACCESS     -> training_scope (new; OWNER_ONLY for this pilot)
--
-- Additive only: new columns, one widened check list, two functions, two policies.
-- No Human Review table, function, state or policy is modified.

-- 1. Training-access dimension on questions ----------------------------------------
alter table public.academy_ism_questions
  add column if not exists training_scope text not null default 'NONE'
    check (training_scope in ('NONE','OWNER_ONLY')),
  add column if not exists training_promoted_by uuid references auth.users(id),
  add column if not exists training_promoted_at timestamptz,
  add column if not exists source_content_sha256 text
    check (source_content_sha256 is null or source_content_sha256 ~ '^[a-f0-9]{64}$');

-- TECHNICALLY_VERIFIED is the truthful state of a question copied straight from a
-- Human Review package whose technical_status is TECHNICALLY_VERIFIED. It is NOT a
-- Human Review outcome and is never treated as HUMAN_REVIEW_ACCEPTED by any policy.
alter table public.academy_ism_questions drop constraint if exists academy_ism_questions_verification_stage_check;
alter table public.academy_ism_questions add constraint academy_ism_questions_verification_stage_check
  check (verification_stage in ('UNVERIFIED_CANDIDATE','CANDIDATE_SOURCED','INDEPENDENTLY_VERIFIED','MASTER_MANIFEST','TECHNICALLY_VERIFIED','HUMAN_REVIEW_ACCEPTED'));

create index if not exists academy_ism_questions_training_scope_idx
  on public.academy_ism_questions(workspace_id,module_code,training_scope);

-- 2. Read policies: the active Owner may read OWNER_ONLY training rows in their own
--    workspace. The existing "members read accepted questions" policy is untouched
--    and still only exposes HUMAN_REVIEW_ACCEPTED rows to ordinary members.
drop policy if exists "owner reads owner-only training questions" on public.academy_ism_questions;
create policy "owner reads owner-only training questions" on public.academy_ism_questions for select
using (
  training_scope='OWNER_ONLY'
  and exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_questions.workspace_id and m.user_id=auth.uid() and m.is_active and m.role::text='owner')
);

drop policy if exists "owner reads training source manifest" on public.academy_ism_source_manifest;
create policy "owner reads training source manifest" on public.academy_ism_source_manifest for select
using (
  exists(select 1 from public.academy_ism_questions q where q.source_manifest_id=academy_ism_source_manifest.id and q.training_scope='OWNER_ONLY')
  and exists(select 1 from public.workspace_members m where m.workspace_id=academy_ism_source_manifest.workspace_id and m.user_id=auth.uid() and m.is_active and m.role::text='owner')
);

-- 3. Owner-private promotion: copies one TECHNICALLY_VERIFIED question from a Human
--    Review package into academy_ism_questions with training_scope OWNER_ONLY.
--    Executable only by service_role (the academy-training Edge Function, which has
--    already verified the caller is an active Owner and consumed an AAL2 step-up).
--    Reads human_review_* only; never writes them.
create or replace function public.academy_ism_owner_promote_training(
  p_workspace_id uuid,p_actor_id uuid,p_package_id uuid,p_question_id text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_pkg public.human_review_packages%rowtype;
  v_q public.human_review_package_questions%rowtype;
  v_payload jsonb;v_evidence jsonb;
  v_existing public.academy_ism_questions%rowtype;
  v_manifest_id uuid;v_row_id uuid;
  v_source_id text;v_version text;v_authority text;v_module text;v_section text;v_flag text;
begin
  if p_request_id is null or char_length(coalesce(p_question_id,'')) not between 1 and 200 then raise exception 'ACADEMY_TRAINING_INPUT_INVALID'; end if;
  if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and m.is_active and m.role::text='owner') then raise exception 'ACADEMY_TRAINING_OWNER_REQUIRED'; end if;
  select * into v_pkg from public.human_review_packages where id=p_package_id and workspace_id=p_workspace_id;
  if not found then raise exception 'ACADEMY_TRAINING_PACKAGE_NOT_FOUND'; end if;
  select * into v_q from public.human_review_package_questions where package_id=p_package_id and question_id=p_question_id;
  if not found then raise exception 'ACADEMY_TRAINING_QUESTION_NOT_FOUND'; end if;
  if v_q.technical_status<>'TECHNICALLY_VERIFIED' then raise exception 'ACADEMY_TRAINING_NOT_TECHNICALLY_VERIFIED'; end if;
  v_payload=v_q.question_payload;v_evidence=coalesce(v_q.evidence_payload,'{}'::jsonb);

  -- idempotent: the same question already promoted from the same package is a no-op
  select * into v_existing from public.academy_ism_questions where workspace_id=p_workspace_id and question_id=p_question_id;
  if found then
    if v_existing.training_scope='OWNER_ONLY' and v_existing.review_package_id=p_package_id then
      return jsonb_build_object('questionRowId',v_existing.id,'questionId',v_existing.question_id,'trainingScope',v_existing.training_scope,'verificationStage',v_existing.verification_stage,'duplicate',true);
    end if;
    raise exception 'ACADEMY_TRAINING_QUESTION_EXISTS';
  end if;

  v_authority=v_payload->>'authority';v_module=v_payload->>'moduleCode';v_version=v_payload->>'sourceVersion';v_section=v_payload->>'sourceSection';v_flag=nullif(v_payload->>'flagAdministration','');
  v_source_id=coalesce(nullif(v_evidence->>'sourceId',''),v_pkg.source_batch_id);
  if v_authority is null or v_module is null or v_version is null or (v_payload->>'prompt') is null or (v_payload->'markingRubric') is null then raise exception 'ACADEMY_TRAINING_INPUT_INVALID'; end if;

  -- provenance row (MASTER_MANIFEST = copied from the master source manifest record; not a Human Review outcome)
  select id into v_manifest_id from public.academy_ism_source_manifest where workspace_id=p_workspace_id and source_id=v_source_id and version=v_version;
  if v_manifest_id is null then
    insert into public.academy_ism_source_manifest(workspace_id,source_id,title,authority,flag_administration,module_code,version,section,content_sha256,verification_stage,review_package_id,created_by)
    values(p_workspace_id,v_source_id,v_pkg.title,v_authority,v_flag,v_module,v_version,v_section,v_q.content_sha256,'MASTER_MANIFEST',p_package_id,p_actor_id)
    returning id into v_manifest_id;
  end if;

  insert into public.academy_ism_questions(workspace_id,question_id,module_code,flag_administration,learning_objective,difficulty,competency_dimension,source_manifest_id,source_version,source_section,question_kind,prompt,choices,correct_answer,expected_reasoning,marking_rubric,pass_threshold,verification_stage,review_package_id,created_by,training_scope,training_promoted_by,training_promoted_at,source_content_sha256)
  values(p_workspace_id,v_q.question_id,v_module,v_flag,v_payload->>'learningObjective',v_payload->>'difficulty',v_payload->>'competencyDimension',v_manifest_id,v_version,v_section,v_payload->>'questionKind',v_payload->>'prompt',v_payload->'choices',coalesce(v_payload->'correctAnswer','null'::jsonb),v_payload->>'expectedReasoning',v_payload->'markingRubric',coalesce((v_payload->>'passThreshold')::numeric,1),'TECHNICALLY_VERIFIED',p_package_id,p_actor_id,'OWNER_ONLY',p_actor_id,clock_timestamp(),v_q.content_sha256)
  returning id into v_row_id;

  return jsonb_build_object('questionRowId',v_row_id,'questionId',v_q.question_id,'sourceManifestId',v_manifest_id,'sourcePackageId',p_package_id,'sourceContentSha256',v_q.content_sha256,'trainingScope','OWNER_ONLY','verificationStage','TECHNICALLY_VERIFIED','promotedBy',p_actor_id,'requestId',p_request_id,'duplicate',false);
end $$;

-- 4. Attempt recording with server-side marking. Callable by any authenticated user,
--    but only for a question that user is allowed to train on: OWNER_ONLY rows for the
--    active Owner, HUMAN_REVIEW_ACCEPTED rows for any active member (existing rule).
--    Writes exactly one academy_ism_attempts row; nothing else.
create or replace function public.academy_ism_submit_attempt(
  p_workspace_id uuid,p_question_row_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid;v_role text;v_q public.academy_ism_questions%rowtype;
  v_key text;v_correct_key text;v_is_correct boolean;v_score numeric;v_attempt_id uuid;v_at timestamptz;v_valid_key boolean;
begin
  v_actor=auth.uid();
  if v_actor is null then raise exception 'ACADEMY_TRAINING_AUTH_REQUIRED'; end if;
  select m.role::text into v_role from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_actor and m.is_active;
  if v_role is null then raise exception 'ACADEMY_TRAINING_MEMBERSHIP_REQUIRED'; end if;
  select * into v_q from public.academy_ism_questions where id=p_question_row_id and workspace_id=p_workspace_id;
  if not found then raise exception 'ACADEMY_TRAINING_QUESTION_NOT_FOUND'; end if;
  if not ((v_q.training_scope='OWNER_ONLY' and v_role='owner') or v_q.verification_stage='HUMAN_REVIEW_ACCEPTED') then raise exception 'ACADEMY_TRAINING_ACCESS_DENIED'; end if;
  if v_q.question_kind<>'multiple_choice' or jsonb_typeof(p_response)<>'object' then raise exception 'ACADEMY_TRAINING_INPUT_INVALID'; end if;
  v_key=p_response->>'key';
  select exists(select 1 from jsonb_array_elements(coalesce(v_q.choices,'[]'::jsonb)) c where c->>'key'=v_key) into v_valid_key;
  if v_key is null or not v_valid_key then raise exception 'ACADEMY_TRAINING_INPUT_INVALID'; end if;
  v_correct_key=coalesce(v_q.marking_rubric->>'correctKey',v_q.correct_answer#>>'{}');
  v_is_correct=(v_key=v_correct_key);
  v_score=coalesce((v_q.marking_rubric->'scoring'->>v_key)::numeric,case when v_is_correct then 1 else 0 end);
  if v_score<0 then v_score=0; end if; if v_score>1 then v_score=1; end if;
  insert into public.academy_ism_attempts(workspace_id,user_id,question_id,response,is_correct,score)
  values(p_workspace_id,v_actor,v_q.id,jsonb_build_object('key',v_key),v_is_correct,v_score)
  returning id,attempted_at into v_attempt_id,v_at;
  return jsonb_build_object('attemptId',v_attempt_id,'questionRowId',v_q.id,'questionId',v_q.question_id,'userId',v_actor,'selectedKey',v_key,'isCorrect',v_is_correct,'score',v_score,'passThreshold',v_q.pass_threshold,'passed',v_score>=v_q.pass_threshold,'correctKey',v_correct_key,'expectedReasoning',v_q.expected_reasoning,'attemptedAt',v_at);
end $$;

revoke all on function public.academy_ism_owner_promote_training(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.academy_ism_owner_promote_training(uuid,uuid,uuid,text,uuid) to service_role;
revoke all on function public.academy_ism_submit_attempt(uuid,uuid,jsonb) from public,anon;
grant execute on function public.academy_ism_submit_attempt(uuid,uuid,jsonb) to authenticated,service_role;

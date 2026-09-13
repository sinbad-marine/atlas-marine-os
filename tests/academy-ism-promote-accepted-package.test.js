'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const {
  IsmPromotionError,
  planPromotion,
  buildSourceManifestRow,
  buildQuestionRow,
} = require('../tools/academy-ism-promote-accepted-package.js');

const validPayload = {
  authority: 'IMO',
  moduleCode: 'ism-code-foundations',
  flagAdministration: null,
  sourceVersion: '2024',
  sourceSection: 'Element 4',
  learningObjective: 'Explain the safety and environmental protection policy requirement',
  difficulty: 'foundation',
  competencyDimension: 'ism_knowledge',
  questionKind: 'multiple_choice',
  prompt: 'What must the Company establish under ISM Code Element 2?',
  choices: ['A', 'B', 'C', 'D'],
  correctAnswer: 'C',
  expectedReasoning: null,
  markingRubric: { keys: ['policy'] },
  passThreshold: 0.7,
};
const ukFlaggedPayload = { ...validPayload, authority: 'UK MCA', flagAdministration: 'UK_MCA', sourceVersion: 'MSN-1', competencyDimension: 'flag_ro_understanding' };
const placeholderPayload = { status: 'CONTENT_PENDING_GROK_GEMINI_VERIFICATION', moduleCode: 'ism-code-foundations', flagAdministration: null };

function acceptedPackage(overrides = {}) {
  return { id: 'pkg-1', workspace_id: 'ws-1', source_batch_id: 'ISM-M1-CORE', title: 'ISM Code foundations', status: 'OWNER_ACCEPTED', ...overrides };
}
function questionRow(id, payload, overrides = {}) {
  return { package_id: 'pkg-1', question_id: id, position: 1, content_sha256: 'a'.repeat(64), question_payload: payload, ...overrides };
}

test('planPromotion refuses to run against a package that is not Owner-accepted', () => {
  assert.throws(
    () => planPromotion({ packageRow: acceptedPackage({ status: 'SUBMITTED_COMPLETE' }), questionRows: [] }),
    (err) => err instanceof IsmPromotionError && err.code === 'ACADEMY_ISM_PROMOTE_PACKAGE_NOT_ACCEPTED',
  );
});

test('a Step 4 placeholder payload is rejected, not promoted with invented content', () => {
  const { groups, rejected } = planPromotion({
    packageRow: acceptedPackage(),
    questionRows: [questionRow('Q1', placeholderPayload)],
  });
  assert.equal(groups.length, 0);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].questionId, 'Q1');
  assert.ok(rejected[0].errors.some((e) => e.code === 'AUTHORITY_INVALID'));
  assert.ok(rejected[0].errors.some((e) => e.code === 'LEARNING_OBJECTIVE_INVALID'));
});

test('a fully-shaped payload, placeholder or real, is promoted the same way - the code cannot tell them apart', () => {
  const realShapedButStillMarked = { ...validPayload, prompt: 'CONTENT_PENDING_GROK_GEMINI_VERIFICATION', learningObjective: 'CONTENT_PENDING_GROK_GEMINI_VERIFICATION' };
  const { groups: realGroups, rejected: realRejected } = planPromotion({ packageRow: acceptedPackage(), questionRows: [questionRow('Q1', validPayload)] });
  const { groups: markedGroups, rejected: markedRejected } = planPromotion({ packageRow: acceptedPackage(), questionRows: [questionRow('Q1', realShapedButStillMarked)] });
  assert.equal(realRejected.length, 0);
  assert.equal(markedRejected.length, 0);
  assert.equal(realGroups.length, 1);
  assert.equal(markedGroups.length, 1);
});

test('questions group by authority/module/flag/version/section, one manifest per distinct source identity', () => {
  const { groups, rejected } = planPromotion({
    packageRow: acceptedPackage(),
    questionRows: [
      questionRow('Q1', validPayload),
      questionRow('Q2', validPayload),
      questionRow('Q3', ukFlaggedPayload),
    ],
  });
  assert.equal(rejected.length, 0);
  assert.equal(groups.length, 2);
  const core = groups.find((g) => g.flagAdministration === null);
  const uk = groups.find((g) => g.flagAdministration === 'UK_MCA');
  assert.equal(core.questions.length, 2);
  assert.equal(uk.questions.length, 1);
});

test('buildSourceManifestRow and buildQuestionRow map every field the real schema requires', () => {
  const { groups } = planPromotion({ packageRow: acceptedPackage(), questionRows: [questionRow('Q1', validPayload)] });
  const manifestRow = buildSourceManifestRow({ workspaceId: 'ws-1', packageRow: acceptedPackage(), group: groups[0], actorId: 'owner-1' });
  assert.equal(manifestRow.workspace_id, 'ws-1');
  assert.equal(manifestRow.authority, 'IMO');
  assert.equal(manifestRow.module_code, 'ism-code-foundations');
  assert.equal(manifestRow.flag_administration, null);
  assert.equal(manifestRow.verification_stage, 'HUMAN_REVIEW_ACCEPTED');
  assert.equal(manifestRow.review_package_id, 'pkg-1');
  assert.match(manifestRow.content_sha256, /^[a-f0-9]{64}$/);

  const questionRowOut = buildQuestionRow({ workspaceId: 'ws-1', item: groups[0].questions[0], sourceManifestId: 'manifest-1', actorId: 'owner-1' });
  assert.equal(questionRowOut.question_id, 'Q1');
  assert.equal(questionRowOut.source_manifest_id, 'manifest-1');
  assert.equal(questionRowOut.competency_dimension, 'ism_knowledge');
  assert.equal(questionRowOut.correct_answer, 'C');
  assert.equal(questionRowOut.verification_stage, 'HUMAN_REVIEW_ACCEPTED');
});

const runtime = path.resolve(__dirname, '../../../tmp/argos-pg-runtime-058');
const runtimeAvailable = fs.existsSync(path.join(runtime, 'node_modules/@electric-sql/pglite/package.json'));
const localRequire = runtimeAvailable ? createRequire(path.join(runtime, 'package.json')) : null;
const { PGlite } = runtimeAvailable ? localRequire('@electric-sql/pglite') : { PGlite: null };
const { pgcrypto } = runtimeAvailable ? localRequire('@electric-sql/pglite/contrib/pgcrypto') : { pgcrypto: null };
const humanReviewMigration = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260903000400_human_reviewer_system.sql'), 'utf8');
const academyIsmMigration = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260906000100_academy_ism_flag_dimension.sql'), 'utf8');

const ids = {
  workspace: '11111111-1111-4111-8111-111111111111',
  owner: '22222222-2222-4222-8222-222222222222',
  student: '33333333-3333-4333-8333-333333333333',
};

async function setup() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
  create table auth.users(id uuid primary key);
  create table public.workspaces(id uuid primary key);
  create type public.workspace_role as enum('owner','developer','visitor');
  create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
  insert into auth.users(id) values('${ids.owner}'),('${ids.student}');
  insert into public.workspaces values('${ids.workspace}');
  insert into public.workspace_members(workspace_id,user_id,role,is_active) values('${ids.workspace}','${ids.owner}','owner',true),('${ids.workspace}','${ids.student}','visitor',true);
  grant select on public.workspaces,public.workspace_members to anon,authenticated;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;`);
  await db.exec(humanReviewMigration);
  await db.exec(academyIsmMigration);
  await db.exec(`grant select,insert on public.academy_flag_administrations,public.academy_ism_source_manifest,public.academy_ism_source_chunks,public.academy_ism_questions,public.academy_ism_attempts,public.academy_ism_mastery,public.academy_ism_readiness to anon,authenticated;
  revoke insert,update,delete on public.academy_ism_source_manifest from anon,authenticated;
  revoke insert,update,delete on public.academy_ism_questions from anon,authenticated;`);
  return db;
}

async function seedAcceptedPackage(db, { packageId, questions }) {
  await db.query(
    `insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,status,assigned_reviewer_id,created_by)
     values($1,$2,'ISM-M1-CORE','draft-0',$3,'ISM Code foundations',25,$4,$4,0,0,'OWNER_ACCEPTED',$5,$5)`,
    [packageId, ids.workspace, 'a'.repeat(64), questions.length, ids.owner],
  );
  for (const [index, q] of questions.entries()) {
    await db.query(
      `insert into public.human_review_package_questions(package_id,question_id,position,source_revision,content_sha256,technical_status,question_payload)
       values($1,$2,$3,'draft-0',$4,'TECHNICALLY_VERIFIED',$5::jsonb)`,
      [packageId, q.questionId, index + 1, 'b'.repeat(64), JSON.stringify(q.payload)],
    );
  }
}

test('a real Owner-accepted package promotes its valid question and rejects its placeholder question, without touching Human Review data', { skip: !runtimeAvailable }, async () => {
  const db = await setup();
  try {
    const packageId = '55555555-5555-4555-8555-000000000001';
    await seedAcceptedPackage(db, {
      packageId,
      questions: [
        { questionId: 'ISM-M1-001', payload: validPayload },
        { questionId: 'ISM-M1-002', payload: placeholderPayload },
      ],
    });
    const beforePackages = (await db.query('select * from public.human_review_packages where id=$1', [packageId])).rows;
    const beforeQuestions = (await db.query('select * from public.human_review_package_questions where package_id=$1 order by position', [packageId])).rows;

    const packageRow = (await db.query('select * from public.human_review_packages where id=$1', [packageId])).rows[0];
    const questionRows = (await db.query('select * from public.human_review_package_questions where package_id=$1 order by position', [packageId])).rows;
    const { groups, rejected } = planPromotion({ packageRow, questionRows });
    assert.equal(groups.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].questionId, 'ISM-M1-002');

    const manifestRow = buildSourceManifestRow({ workspaceId: ids.workspace, packageRow, group: groups[0], actorId: ids.owner });
    const inserted = (await db.query(
      `insert into public.academy_ism_source_manifest(workspace_id,source_id,title,authority,flag_administration,module_code,version,section,content_sha256,verification_stage,review_package_id,created_by)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [manifestRow.workspace_id, manifestRow.source_id, manifestRow.title, manifestRow.authority, manifestRow.flag_administration, manifestRow.module_code, manifestRow.version, manifestRow.section, manifestRow.content_sha256, manifestRow.verification_stage, manifestRow.review_package_id, manifestRow.created_by],
    )).rows[0];
    for (const item of groups[0].questions) {
      const q = buildQuestionRow({ workspaceId: ids.workspace, item, sourceManifestId: inserted.id, actorId: ids.owner });
      await db.query(
        `insert into public.academy_ism_questions(workspace_id,question_id,module_code,flag_administration,learning_objective,difficulty,competency_dimension,source_manifest_id,source_version,source_section,question_kind,prompt,choices,correct_answer,expected_reasoning,marking_rubric,pass_threshold,verification_stage,review_package_id,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [q.workspace_id, q.question_id, q.module_code, q.flag_administration, q.learning_objective, q.difficulty, q.competency_dimension, q.source_manifest_id, q.source_version, q.source_section, q.question_kind, q.prompt, JSON.stringify(q.choices), JSON.stringify(q.correct_answer), q.expected_reasoning, JSON.stringify(q.marking_rubric), q.pass_threshold, q.verification_stage, q.review_package_id, q.created_by],
      );
    }

    const promotedRows = (await db.query('select question_id,verification_stage from public.academy_ism_questions where workspace_id=$1', [ids.workspace])).rows;
    assert.deepEqual(promotedRows, [{ question_id: 'ISM-M1-001', verification_stage: 'HUMAN_REVIEW_ACCEPTED' }]);
    assert.equal(promotedRows.some((r) => r.question_id === 'ISM-M1-002'), false);

    const studentSees = (await db.exec(`select set_config('request.jwt.claim.sub','${ids.student}',true);set local role authenticated; select question_id from public.academy_ism_questions;`))[2].rows;
    assert.deepEqual(studentSees, [{ question_id: 'ISM-M1-001' }]);

    const afterPackages = (await db.query('select * from public.human_review_packages where id=$1', [packageId])).rows;
    const afterQuestions = (await db.query('select * from public.human_review_package_questions where package_id=$1 order by position', [packageId])).rows;
    assert.deepEqual(afterPackages, beforePackages);
    assert.deepEqual(afterQuestions, beforeQuestions);
  } finally {
    await db.close();
  }
});

test('planPromotion refuses a package that is only submitted, not yet Owner-accepted, before any academy_ism write is attempted', { skip: !runtimeAvailable }, async () => {
  const db = await setup();
  try {
    const packageId = '55555555-5555-4555-8555-000000000002';
    await db.query(
      `insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,status,assigned_reviewer_id,created_by)
       values($1,$2,'ISM-M1-CORE','draft-0',$3,'ISM Code foundations',25,1,1,0,0,'SUBMITTED_COMPLETE',$4,$4)`,
      [packageId, ids.workspace, 'a'.repeat(64), ids.owner],
    );
    const packageRow = (await db.query('select * from public.human_review_packages where id=$1', [packageId])).rows[0];
    assert.throws(() => planPromotion({ packageRow, questionRows: [] }), (err) => err.code === 'ACADEMY_ISM_PROMOTE_PACKAGE_NOT_ACCEPTED');
    const count = Number((await db.query('select count(*) n from public.academy_ism_questions')).rows[0].n);
    assert.equal(count, 0);
  } finally {
    await db.close();
  }
});

test('re-inserting the same source manifest identity upserts one row, not two, under the schema\'s own uniqueness constraint', { skip: !runtimeAvailable }, async () => {
  const db = await setup();
  try {
    const row = {
      workspace_id: ids.workspace, source_id: 'ISM-M1-CORE:ism-code-foundations:CORE', title: 'ISM Code foundations',
      authority: 'IMO', flag_administration: null, module_code: 'ism-code-foundations', version: '2024', section: null,
      content_sha256: 'c'.repeat(64), verification_stage: 'HUMAN_REVIEW_ACCEPTED', review_package_id: null, created_by: ids.owner,
    };
    for (let i = 0; i < 2; i += 1) {
      await db.query(
        `insert into public.academy_ism_source_manifest(workspace_id,source_id,title,authority,flag_administration,module_code,version,section,content_sha256,verification_stage,review_package_id,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (workspace_id,source_id,version) do update set content_sha256=excluded.content_sha256`,
        [row.workspace_id, row.source_id, row.title, row.authority, row.flag_administration, row.module_code, row.version, row.section, row.content_sha256, row.verification_stage, row.review_package_id, row.created_by],
      );
    }
    const count = Number((await db.query('select count(*) n from public.academy_ism_source_manifest where source_id=$1', [row.source_id])).rows[0].n);
    assert.equal(count, 1);
  } finally {
    await db.close();
  }
});

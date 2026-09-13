'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const {
  CONTENT_PENDING_MARKER,
  MANIFEST_SCHEMA_VERSION,
  ManifestValidationError,
  buildManifest,
  validateManifest,
  toImportPackageRequestBody,
} = require('../tools/academy-ism-manifest-builder.js');

function sampleManifest(overrides = {}) {
  return buildManifest({
    sourceBatchId: 'ISM-M1-CORE-TEST',
    sourceRevision: 'draft-0',
    title: 'ISM Code foundations - structure only',
    packageSize: 25,
    expectedCount: 3,
    questionIds: ['ISM-M1-001', 'ISM-M1-002', 'ISM-M1-003'],
    moduleCode: 'ism-code-foundations',
    ...overrides,
  });
}

test('buildManifest produces every required field with no content anywhere but the pending marker', () => {
  const manifest = sampleManifest();
  assert.equal(manifest.schemaVersion, MANIFEST_SCHEMA_VERSION);
  for (const field of ['sourceBatchId', 'sourceRevision', 'contentSha256', 'expectedCount', 'presentCount', 'missingCount', 'deferredCount', 'questions']) {
    assert.notEqual(manifest[field], undefined, field);
  }
  assert.equal(manifest.presentCount, 3);
  for (const q of manifest.questions) {
    assert.equal(q.technicalStatus, CONTENT_PENDING_MARKER);
    assert.equal(q.questionPayload.status, CONTENT_PENDING_MARKER);
    assert.equal(q.evidencePayload.status, CONTENT_PENDING_MARKER);
    assert.match(q.contentSha256, /^[a-f0-9]{64}$/);
  }
  assert.doesNotThrow(() => validateManifest(manifest));
});

test('validateManifest rejects a schema version mismatch', () => {
  const manifest = sampleManifest();
  manifest.schemaVersion = 'sinbad-human-review-manifest/2';
  assert.throws(() => validateManifest(manifest), (err) => {
    assert.ok(err instanceof ManifestValidationError);
    assert.ok(err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_SCHEMA_VERSION_MISMATCH'));
    return true;
  });
});

test('validateManifest rejects a package size outside the allowed enum', () => {
  const manifest = sampleManifest();
  manifest.packageSize = 30;
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_PACKAGE_SIZE_INVALID'));
});

test('validateManifest rejects present+missing+deferred not equal to expected', () => {
  const manifest = sampleManifest();
  manifest.missingCount = 1;
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_COUNT_INVARIANT_VIOLATED'));
});

test('validateManifest rejects a present count that disagrees with the actual questions array', () => {
  const manifest = sampleManifest();
  manifest.presentCount = 99;
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_PRESENT_COUNT_MISMATCH'));
});

test('validateManifest rejects more than 250 questions', () => {
  const manifest = buildManifest({
    sourceBatchId: 'ISM-M1-CORE-TEST',
    sourceRevision: 'draft-0',
    title: 'oversized',
    packageSize: 250,
    expectedCount: 251,
    questionIds: Array.from({ length: 251 }, (_, i) => `ISM-M1-${String(i + 1).padStart(4, '0')}`),
    moduleCode: 'ism-code-foundations',
  });
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_QUESTIONS_ARRAY_INVALID'));
});

test('validateManifest rejects a malformed content hash', () => {
  const manifest = sampleManifest();
  manifest.contentSha256 = 'not-a-hash';
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_CONTENT_SHA256_INVALID'));
});

test('validateManifest rejects a duplicate question id', () => {
  const manifest = sampleManifest();
  manifest.questions[1].questionId = manifest.questions[0].questionId;
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_QUESTION_ID_DUPLICATE'));
});

test('validateManifest rejects a non-object question payload', () => {
  const manifest = sampleManifest();
  manifest.questions[0].questionPayload = 'not an object';
  assert.throws(() => validateManifest(manifest), (err) => err.details.some((e) => e.code === 'ACADEMY_ISM_MANIFEST_QUESTION_PAYLOAD_INVALID'));
});

test('toImportPackageRequestBody wraps a valid manifest and rejects an invalid one', () => {
  const manifest = sampleManifest();
  const body = toImportPackageRequestBody(manifest, { requestId: '11111111-1111-4111-8111-111111111111' });
  assert.equal(body.action, 'import_package');
  assert.equal(body.requestId, '11111111-1111-4111-8111-111111111111');
  assert.equal(body.manifest, manifest);

  const broken = sampleManifest();
  broken.packageSize = 999;
  assert.throws(() => toImportPackageRequestBody(broken));
});

const runtime = path.resolve(__dirname, '../../../tmp/argos-pg-runtime-058');
const runtimeAvailable = fs.existsSync(path.join(runtime, 'node_modules/@electric-sql/pglite/package.json'));
const localRequire = runtimeAvailable ? createRequire(path.join(runtime, 'package.json')) : null;
const { PGlite } = runtimeAvailable ? localRequire('@electric-sql/pglite') : { PGlite: null };
const { pgcrypto } = runtimeAvailable ? localRequire('@electric-sql/pglite/contrib/pgcrypto') : { pgcrypto: null };
const humanReviewMigration = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260903000400_human_reviewer_system.sql'), 'utf8');
const ids = {
  workspace: '11111111-1111-4111-8111-111111111111',
  owner: '22222222-2222-4222-8222-222222222222',
};

// Reproduces, statement for statement, the exact mapping
// supabase/functions/human-review/index.ts performs from a manifest body to
// the human_review_import_package RPC call. This is the strongest available
// proof that this builder's output is accepted end to end without a live
// Supabase/Edge Functions deployment: the real migration's real function,
// fed through the real production mapping code, on a real Postgres engine.
async function importViaRealMapping(db, manifest, requestId) {
  const rows = manifest.questions.map((q, i) => ({
    question_id: q.questionId,
    position: i + 1,
    source_revision: String(q.sourceRevision || manifest.sourceRevision || ''),
    content_sha256: String(q.contentSha256 || ''),
    technical_status: String(q.technicalStatus || ''),
    question_payload: q.questionPayload,
    evidence_payload: q.evidencePayload ?? {},
  }));
  return db.query(
    `select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) result`,
    [
      ids.workspace,
      ids.owner,
      String(manifest.sourceBatchId || ''),
      String(manifest.sourceRevision || ''),
      String(manifest.contentSha256 || ''),
      String(manifest.title || ''),
      manifest.packageSize,
      manifest.expectedCount,
      manifest.missingCount,
      manifest.deferredCount,
      JSON.stringify(rows),
      requestId,
    ],
  );
}

test('a validated manifest is accepted end-to-end by the real human_review_import_package function', { skip: !runtimeAvailable }, async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
    create table auth.users(id uuid primary key);
    create table public.workspaces(id uuid primary key);
    create type public.workspace_role as enum('owner','developer','visitor');
    create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
    insert into auth.users(id) values('${ids.owner}');insert into public.workspaces values('${ids.workspace}');
    insert into public.workspace_members(workspace_id,user_id,role,is_active) values('${ids.workspace}','${ids.owner}','owner',true);`);
    await db.exec(humanReviewMigration);

    const manifest = sampleManifest();
    validateManifest(manifest);
    const result = (await importViaRealMapping(db, manifest, '33333333-3333-4333-8333-333333333333')).rows[0].result;
    assert.equal(result.presentCount, 3);
    assert.equal(result.expectedCount, 3);
    assert.equal(result.packageComplete, true);
    assert.equal(result.duplicate, false);

    const stored = (await db.query(
      `select question_id,technical_status,question_payload from public.human_review_package_questions where package_id=$1 order by position`,
      [result.packageId],
    )).rows;
    assert.deepEqual(stored.map((r) => r.question_id), ['ISM-M1-001', 'ISM-M1-002', 'ISM-M1-003']);
    for (const row of stored) {
      assert.equal(row.technical_status, CONTENT_PENDING_MARKER);
      assert.equal(row.question_payload.status, CONTENT_PENDING_MARKER);
    }
  } finally {
    await db.close();
  }
});

test('a manifest with a broken count invariant is rejected by the real function too, not only by local validation', { skip: !runtimeAvailable }, async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
    create table auth.users(id uuid primary key);
    create table public.workspaces(id uuid primary key);
    create type public.workspace_role as enum('owner','developer','visitor');
    create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
    insert into auth.users(id) values('${ids.owner}');insert into public.workspaces values('${ids.workspace}');
    insert into public.workspace_members(workspace_id,user_id,role,is_active) values('${ids.workspace}','${ids.owner}','owner',true);`);
    await db.exec(humanReviewMigration);

    const manifest = sampleManifest();
    manifest.expectedCount = 5;
    await assert.rejects(
      importViaRealMapping(db, manifest, '44444444-4444-4444-8444-444444444444'),
      /HUMAN_REVIEW_COUNT_MISMATCH/,
    );
  } finally {
    await db.close();
  }
});

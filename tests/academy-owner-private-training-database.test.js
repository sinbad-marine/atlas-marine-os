'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

const runtime=path.resolve(__dirname,'../../../tmp/argos-pg-runtime-058');
const runtimeAvailable=fs.existsSync(path.join(runtime,'node_modules/@electric-sql/pglite/package.json'));
const localRequire=runtimeAvailable?createRequire(path.join(runtime,'package.json')):null;
const {PGlite}=runtimeAvailable?localRequire('@electric-sql/pglite'):{PGlite:null};
const {pgcrypto}=runtimeAvailable?localRequire('@electric-sql/pglite/contrib/pgcrypto'):{pgcrypto:null};
const humanReviewMigration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260903000400_human_reviewer_system.sql'),'utf8');
const academyMigration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260906000100_academy_ism_flag_dimension.sql'),'utf8');
const trainingMigration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260914000100_academy_owner_private_training.sql'),'utf8');
const pilot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/academy/ism-master-source-manifest/PILOT-001-first-question-package.json'),'utf8'));

const ids={
 workspace:'11111111-1111-4111-8111-111111111111',
 owner:'22222222-2222-4222-8222-222222222222',
 visitor:'33333333-3333-4333-8333-333333333333',
 otherOwnerWorkspaceUser:'44444444-4444-4444-8444-444444444444',
 pkg:'b513867b-e4e2-4be1-9595-7a123f8bf792',
 request:'2adfd7ff-0520-4cb0-a544-fadc72fcba25',
 request2:'3adfd7ff-0520-4cb0-a544-fadc72fcba25',
};
const q=pilot.manifest.questions[0];

async function setup(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);
 create table public.workspaces(id uuid primary key);
 create type public.workspace_role as enum('owner','developer','visitor');
 create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
 insert into auth.users(id) values('${ids.owner}'),('${ids.visitor}'),('${ids.otherOwnerWorkspaceUser}');
 insert into public.workspaces values('${ids.workspace}');
 insert into public.workspace_members(workspace_id,user_id,role,is_active) values
   ('${ids.workspace}','${ids.owner}','owner',true),
   ('${ids.workspace}','${ids.visitor}','visitor',true);
 grant select on public.workspaces,public.workspace_members to anon,authenticated;`);
 await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$
   select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
 $$;
 grant usage on schema auth to anon, authenticated;`);
 await db.exec(humanReviewMigration);
 await db.exec(academyMigration);
 await db.exec(trainingMigration);
 await db.exec(`grant select,insert on public.academy_flag_administrations,public.academy_ism_source_manifest,public.academy_ism_source_chunks,public.academy_ism_questions,public.academy_ism_attempts,public.academy_ism_mastery,public.academy_ism_readiness to anon,authenticated;
 revoke insert,update,delete on public.academy_flag_administrations from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_source_manifest from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_source_chunks from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_questions from anon,authenticated;
 revoke update,delete on public.academy_ism_attempts from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_mastery from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_readiness from anon,authenticated;`);
 // the real PILOT-001 manifest goes through the real import function (as the Edge Function would call it)
 const rows=pilot.manifest.questions.map((item,i)=>({question_id:item.questionId,position:i+1,source_revision:item.sourceRevision,content_sha256:item.contentSha256,technical_status:item.technicalStatus,question_payload:item.questionPayload,evidence_payload:item.evidencePayload||{}}));
 const imported=await db.query(`select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) as r`,[ids.workspace,ids.owner,pilot.manifest.sourceBatchId,pilot.manifest.sourceRevision,pilot.manifest.contentSha256,pilot.manifest.title,pilot.manifest.packageSize,pilot.manifest.expectedCount,pilot.manifest.missingCount,pilot.manifest.deferredCount,JSON.stringify(rows),ids.request]);
 const packageId=imported.rows[0].r.packageId;
 return {db,packageId};
}
const asUser=userId=>`select set_config('request.jwt.claim.sub','${userId}',true);set local role authenticated;`;

test('Owner-private promotion copies the TECHNICALLY_VERIFIED PILOT-001 question with provenance, without touching the Human Review package',{skip:!runtimeAvailable},async()=>{
 const {db,packageId}=await setup();
 try{
  const before=(await db.query('select status,lock_version,assignment_generation from public.human_review_packages where id=$1',[packageId])).rows[0];
  const result=(await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5) as r',[ids.workspace,ids.owner,packageId,q.questionId,ids.request2])).rows[0].r;
  assert.equal(result.duplicate,false);
  assert.equal(result.questionId,q.questionId);
  assert.equal(result.trainingScope,'OWNER_ONLY');
  assert.equal(result.verificationStage,'TECHNICALLY_VERIFIED');
  assert.equal(result.sourceContentSha256,q.contentSha256);
  assert.equal(result.sourcePackageId,packageId);
  const row=(await db.query('select question_id,module_code,prompt,choices,correct_answer,marking_rubric,pass_threshold,verification_stage,training_scope,review_package_id,source_content_sha256,training_promoted_by,source_version,source_section from public.academy_ism_questions where workspace_id=$1 and question_id=$2',[ids.workspace,q.questionId])).rows[0];
  assert.equal(row.prompt,q.questionPayload.prompt);
  assert.deepEqual(row.choices,q.questionPayload.choices);
  assert.equal(row.correct_answer,q.questionPayload.correctAnswer);
  assert.deepEqual(row.marking_rubric,q.questionPayload.markingRubric);
  assert.equal(Number(row.pass_threshold),q.questionPayload.passThreshold);
  assert.equal(row.verification_stage,'TECHNICALLY_VERIFIED');
  assert.equal(row.training_scope,'OWNER_ONLY');
  assert.equal(row.review_package_id,packageId);
  assert.equal(row.source_content_sha256,q.contentSha256);
  assert.equal(row.training_promoted_by,ids.owner);
  assert.equal(row.source_version,q.questionPayload.sourceVersion);
  const manifest=(await db.query('select source_id,version,verification_stage,review_package_id,content_sha256 from public.academy_ism_source_manifest where workspace_id=$1',[ids.workspace])).rows;
  assert.deepEqual(manifest,[{source_id:q.evidencePayload.sourceId,version:q.questionPayload.sourceVersion,verification_stage:'MASTER_MANIFEST',review_package_id:packageId,content_sha256:q.contentSha256}]);
  const after=(await db.query('select status,lock_version,assignment_generation from public.human_review_packages where id=$1',[packageId])).rows[0];
  assert.deepEqual(after,before,'Human Review package state must not change');
  assert.equal(after.status,'AVAILABLE');
  const audit=(await db.query('select action from public.human_review_audit where package_id=$1 order by id',[packageId])).rows.map(r=>r.action);
  assert.deepEqual(audit,['PACKAGE_IMPORTED'],'no Human Review audit event is written by training promotion');
 }finally{await db.close();}
});

test('promotion is idempotent for the same question and refuses non-Owner, wrong package and non-verified sources',{skip:!runtimeAvailable},async()=>{
 const {db,packageId}=await setup();
 try{
  await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,packageId,q.questionId,ids.request2]);
  const again=(await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5) as r',[ids.workspace,ids.owner,packageId,q.questionId,'5adfd7ff-0520-4cb0-a544-fadc72fcba25'])).rows[0].r;
  assert.equal(again.duplicate,true);
  assert.equal((await db.query('select count(*)::int as n from public.academy_ism_questions')).rows[0].n,1);
  await assert.rejects(db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.visitor,packageId,q.questionId,'6adfd7ff-0520-4cb0-a544-fadc72fcba25']),/ACADEMY_TRAINING_OWNER_REQUIRED/);
  await assert.rejects(db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,'00000000-0000-4000-8000-000000000000',q.questionId,'7adfd7ff-0520-4cb0-a544-fadc72fcba25']),/ACADEMY_TRAINING_PACKAGE_NOT_FOUND/);
  await assert.rejects(db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,packageId,'ISM-M1-EL2-Q999','8adfd7ff-0520-4cb0-a544-fadc72fcba25']),/ACADEMY_TRAINING_QUESTION_NOT_FOUND/);
  await db.query(`update public.human_review_package_questions set technical_status='TECHNICALLY_PENDING' where package_id=$1`,[packageId]);
  await db.query('delete from public.academy_ism_questions');
  await assert.rejects(db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,packageId,q.questionId,'9adfd7ff-0520-4cb0-a544-fadc72fcba25']),/ACADEMY_TRAINING_NOT_TECHNICALLY_VERIFIED/);
 }finally{await db.close();}
});

test('promoted OWNER_ONLY question is readable by the active Owner and invisible to an ordinary member; HUMAN_REVIEW_ACCEPTED policy unchanged',{skip:!runtimeAvailable},async()=>{
 const {db,packageId}=await setup();
 try{
  await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,packageId,q.questionId,ids.request2]);
  const ownerRows=(await db.exec(`${asUser(ids.owner)} select question_id,training_scope,verification_stage from public.academy_ism_questions;`))[2].rows;
  assert.deepEqual(ownerRows,[{question_id:q.questionId,training_scope:'OWNER_ONLY',verification_stage:'TECHNICALLY_VERIFIED'}]);
  const visitorRows=(await db.exec(`${asUser(ids.visitor)} select question_id from public.academy_ism_questions;`))[2].rows;
  assert.deepEqual(visitorRows,[],'a visitor must not see Owner-only training rows');
  const anonRows=(await db.exec(`select set_config('request.jwt.claim.sub','',true);set local role anon; select question_id from public.academy_ism_questions;`))[2].rows;
  assert.deepEqual(anonRows,[]);
  const ownerManifest=(await db.exec(`${asUser(ids.owner)} select source_id from public.academy_ism_source_manifest;`))[2].rows;
  assert.deepEqual(ownerManifest,[{source_id:q.evidencePayload.sourceId}]);
  const visitorManifest=(await db.exec(`${asUser(ids.visitor)} select source_id from public.academy_ism_source_manifest;`))[2].rows;
  assert.deepEqual(visitorManifest,[]);
 }finally{await db.close();}
});

test('Owner submits an attempt: server-side marking, private persistence, own read-back, no cross-user access',{skip:!runtimeAvailable},async()=>{
 const {db,packageId}=await setup();
 try{
  const promoted=(await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5) as r',[ids.workspace,ids.owner,packageId,q.questionId,ids.request2])).rows[0].r;
  const rowId=promoted.questionRowId;
  const wrong=(await db.exec(`${asUser(ids.owner)} select public.academy_ism_submit_attempt('${ids.workspace}','${rowId}','{"key":"B"}'::jsonb) as r;`))[2].rows[0].r;
  assert.equal(wrong.isCorrect,false);assert.equal(Number(wrong.score),0);assert.equal(wrong.correctKey,'A');assert.equal(wrong.passed,false);assert.equal(wrong.userId,ids.owner);
  const right=(await db.exec(`${asUser(ids.owner)} select public.academy_ism_submit_attempt('${ids.workspace}','${rowId}','{"key":"A"}'::jsonb) as r;`))[2].rows[0].r;
  assert.equal(right.isCorrect,true);assert.equal(Number(right.score),1);assert.equal(right.passed,true);assert.equal(right.questionId,q.questionId);assert.match(String(right.expectedReasoning),/establish/);
  const own=(await db.exec(`${asUser(ids.owner)} select response,is_correct,score::text from public.academy_ism_attempts order by attempted_at;`))[2].rows;
  assert.deepEqual(own,[{response:{key:'B'},is_correct:false,score:'0'},{response:{key:'A'},is_correct:true,score:'1'}]);
  const other=(await db.exec(`${asUser(ids.visitor)} select id from public.academy_ism_attempts;`))[2].rows;
  assert.deepEqual(other,[],'another user must not read the Owner attempts');
  await assert.rejects(db.exec(`${asUser(ids.visitor)} select public.academy_ism_submit_attempt('${ids.workspace}','${rowId}','{"key":"A"}'::jsonb);`),/ACADEMY_TRAINING_ACCESS_DENIED/);
  await assert.rejects(db.exec(`${asUser(ids.owner)} select public.academy_ism_submit_attempt('${ids.workspace}','${rowId}','{"key":"Z"}'::jsonb);`),/ACADEMY_TRAINING_INPUT_INVALID/);
  await assert.rejects(db.exec(`select set_config('request.jwt.claim.sub','',true);set local role anon; select public.academy_ism_submit_attempt('${ids.workspace}','${rowId}','{"key":"A"}'::jsonb);`),/permission denied|ACADEMY_TRAINING_AUTH_REQUIRED/);
  await db.exec(`${asUser(ids.owner)}
  do $$ begin
    update public.academy_ism_attempts set is_correct=true;
    raise exception 'OWNER_COULD_UPDATE_ATTEMPT';
  exception when insufficient_privilege then null; end $$;`);
 }finally{await db.close();}
});

test('training promotion never grants Human Review meaning: no row becomes HUMAN_REVIEW_ACCEPTED and ordinary members still see nothing',{skip:!runtimeAvailable},async()=>{
 const {db,packageId}=await setup();
 try{
  await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5)',[ids.workspace,ids.owner,packageId,q.questionId,ids.request2]);
  const stages=(await db.query(`select verification_stage,count(*)::int as n from public.academy_ism_questions group by verification_stage`)).rows;
  assert.deepEqual(stages,[{verification_stage:'TECHNICALLY_VERIFIED',n:1}]);
  assert.equal((await db.query(`select count(*)::int as n from public.academy_ism_questions where verification_stage='HUMAN_REVIEW_ACCEPTED'`)).rows[0].n,0);
 }finally{await db.close();}
});

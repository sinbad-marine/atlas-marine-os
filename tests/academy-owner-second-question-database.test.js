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
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const migrations=['supabase/migrations/20260903000400_human_reviewer_system.sql','supabase/migrations/20260906000100_academy_ism_flag_dimension.sql','supabase/migrations/20260914000100_academy_owner_private_training.sql'].map(read);
const pilot1=JSON.parse(read('docs/academy/ism-master-source-manifest/PILOT-001-first-question-package.json'));
const pilot2=JSON.parse(read('docs/academy/ism-master-source-manifest/PILOT-002-second-question-package.json'));
const source=JSON.parse(read('docs/academy/ism-master-source-manifest/PILOT-001.json'));
const contract=require('../tools/academy-ism-question-payload-contract.js');
const builder=require('../tools/academy-ism-manifest-builder.js');

const ids={workspace:'11111111-1111-4111-8111-111111111111',owner:'22222222-2222-4222-8222-222222222222',visitor:'33333333-3333-4333-8333-333333333333'};
const asUser=userId=>`select set_config('request.jwt.claim.sub','${userId}',true);set local role authenticated;`;

test('PILOT-002 is a single verified question grounded verbatim in the verified Element 4 source with builder-consistent hashes',()=>{
 const m=pilot2.manifest,q=m.questions[0];
 assert.equal(m.questions.length,1);assert.equal(m.expectedCount,1);assert.equal(q.questionId,'ISM-M1-EL4-Q002');
 assert.deepEqual(contract.checkIsmQuestionPayload(q.questionPayload),{valid:true});
 builder.validateManifest(m);
 assert.equal(q.contentSha256,builder.sha256Hex(JSON.stringify(q.questionPayload)));
 assert.equal(m.contentSha256,builder.sha256Hex(m.questions.map(x=>x.contentSha256).join(':')));
 const el4=source.verifiedSources.find(s=>s.sourceId===q.evidencePayload.sourceId);
 assert.ok(el4,'evidence sourceId must exist in the verified master manifest');
 assert.ok(el4.fullText.includes(pilot2.verbatimAnchor),'verbatim anchor must be present in the verified source text');
 assert.ok(q.questionPayload.expectedReasoning.includes(pilot2.verbatimAnchor));
 assert.equal(q.questionPayload.sourceSection,el4.section);
 assert.notEqual(q.questionId,pilot1.manifest.questions[0].questionId);
 assert.notEqual(m.sourceBatchId,pilot1.manifest.sourceBatchId);
});

async function setup(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);create table public.workspaces(id uuid primary key);
 create type public.workspace_role as enum('owner','developer','visitor');
 create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
 insert into auth.users(id) values('${ids.owner}'),('${ids.visitor}');insert into public.workspaces values('${ids.workspace}');
 insert into public.workspace_members(workspace_id,user_id,role,is_active) values('${ids.workspace}','${ids.owner}','owner',true),('${ids.workspace}','${ids.visitor}','visitor',true);
 grant select on public.workspaces,public.workspace_members to anon,authenticated;
 create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to anon, authenticated;`);
 for(const sql of migrations)await db.exec(sql);
 await db.exec(`grant select,insert on public.academy_flag_administrations,public.academy_ism_source_manifest,public.academy_ism_source_chunks,public.academy_ism_questions,public.academy_ism_attempts,public.academy_ism_mastery,public.academy_ism_readiness to anon,authenticated;
 revoke insert,update,delete on public.academy_ism_source_manifest,public.academy_ism_questions from anon,authenticated;revoke update,delete on public.academy_ism_attempts from anon,authenticated;`);
 return db;
}
async function importAndPromote(db,pkg,requestSeed){
 const m=pkg.manifest,rows=m.questions.map((item,i)=>({question_id:item.questionId,position:i+1,source_revision:item.sourceRevision,content_sha256:item.contentSha256,technical_status:item.technicalStatus,question_payload:item.questionPayload,evidence_payload:item.evidencePayload||{}}));
 const imported=(await db.query(`select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) as r`,[ids.workspace,ids.owner,m.sourceBatchId,m.sourceRevision,m.contentSha256,m.title,m.packageSize,m.expectedCount,m.missingCount,m.deferredCount,JSON.stringify(rows),`${requestSeed}adfd7ff-0520-4cb0-a544-fadc72fcba25`])).rows[0].r;
 const promoted=(await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5) as r',[ids.workspace,ids.owner,imported.packageId,m.questions[0].questionId,`${requestSeed}bdfd7ff-0520-4cb0-a544-fadc72fcba25`])).rows[0].r;
 return {imported,promoted};
}

test('Q001 and Q002 promote as two distinct Owner-only rows from two distinct packages, no duplicate, Human Review untouched',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  const one=await importAndPromote(db,pilot1,'1'),two=await importAndPromote(db,pilot2,'2');
  assert.notEqual(one.imported.packageId,two.imported.packageId);
  assert.equal(one.promoted.duplicate,false);assert.equal(two.promoted.duplicate,false);
  assert.equal(two.promoted.questionId,'ISM-M1-EL4-Q002');assert.equal(two.promoted.sourceContentSha256,pilot2.manifest.questions[0].contentSha256);
  const rows=(await db.query(`select question_id,training_scope,verification_stage,review_package_id,source_content_sha256 from public.academy_ism_questions order by question_id`)).rows;
  assert.deepEqual(rows.map(r=>r.question_id),['ISM-M1-EL2-Q001','ISM-M1-EL4-Q002']);
  assert.ok(rows.every(r=>r.training_scope==='OWNER_ONLY'&&r.verification_stage==='TECHNICALLY_VERIFIED'));
  assert.equal(rows[1].review_package_id,two.imported.packageId);
  const again=(await db.query('select public.academy_ism_owner_promote_training($1,$2,$3,$4,$5) as r',[ids.workspace,ids.owner,two.imported.packageId,'ISM-M1-EL4-Q002','4bdfd7ff-0520-4cb0-a544-fadc72fcba25'])).rows[0].r;
  assert.equal(again.duplicate,true);
  assert.equal((await db.query('select count(*)::int as n from public.academy_ism_questions')).rows[0].n,2);
  const manifests=(await db.query('select source_id from public.academy_ism_source_manifest order by source_id')).rows.map(r=>r.source_id);
  assert.deepEqual(manifests,['IMO-ISM-A741-18-EL2','IMO-ISM-A741-18-EL4']);
  const pkgs=(await db.query('select status,lock_version from public.human_review_packages order by created_at')).rows;
  assert.deepEqual(pkgs,[{status:'AVAILABLE',lock_version:0},{status:'AVAILABLE',lock_version:0}]);
 }finally{await db.close();}
});

test('Owner answers Q001 then Q002; both attempts persist privately and are read back per question after a fresh session',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  const one=await importAndPromote(db,pilot1,'1'),two=await importAndPromote(db,pilot2,'2');
  const a1=(await db.exec(`${asUser(ids.owner)} select public.academy_ism_submit_attempt('${ids.workspace}','${one.promoted.questionRowId}','{"key":"A"}'::jsonb) as r;`))[2].rows[0].r;
  const a2=(await db.exec(`${asUser(ids.owner)} select public.academy_ism_submit_attempt('${ids.workspace}','${two.promoted.questionRowId}','{"key":"C"}'::jsonb) as r;`))[2].rows[0].r;
  assert.equal(a1.isCorrect,true);assert.equal(a2.isCorrect,false);assert.equal(a2.correctKey,'A');
  // "reload": a new session as the same Owner sees exactly its two attempts, each bound to its question row
  const back=(await db.exec(`${asUser(ids.owner)} select q.question_id,a.response,a.is_correct from public.academy_ism_attempts a join public.academy_ism_questions q on q.id=a.question_id order by a.attempted_at;`))[2].rows;
  assert.deepEqual(back,[{question_id:'ISM-M1-EL2-Q001',response:{key:'A'},is_correct:true},{question_id:'ISM-M1-EL4-Q002',response:{key:'C'},is_correct:false}]);
  const answeredIds=(await db.exec(`${asUser(ids.owner)} select distinct question_id from public.academy_ism_attempts;`))[2].rows.length;
  assert.equal(answeredIds,2);
  const visitor=(await db.exec(`${asUser(ids.visitor)} select count(*)::int as n from public.academy_ism_attempts;`))[2].rows[0].n;
  assert.equal(visitor,0);
 }finally{await db.close();}
});

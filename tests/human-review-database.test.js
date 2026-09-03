'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

const runtime=path.resolve(__dirname,'../../../tmp/argos-pg-runtime-058');
const localRequire=createRequire(path.join(runtime,'package.json'));
const {PGlite}=localRequire('@electric-sql/pglite');
const {pgcrypto}=localRequire('@electric-sql/pglite/contrib/pgcrypto');
const migration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260903000400_human_reviewer_system.sql'),'utf8');
const rollback=fs.readFileSync(path.resolve(__dirname,'../supabase/rollback/20260903000400_human_reviewer_system_preserve_data.sql'),'utf8');
const ids={workspace:'11111111-1111-4111-8111-111111111111',owner:'22222222-2222-4222-8222-222222222222',a:'33333333-3333-4333-8333-333333333333',b:'44444444-4444-4444-8444-444444444444',pkg:'55555555-5555-4555-8555-555555555555',pkg2:'66666666-6666-4666-8666-666666666666'};
const req=n=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`;

async function setup(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);
 create table public.workspaces(id uuid primary key);
 create type public.workspace_role as enum('owner','developer','visitor');
 create table public.workspace_members(workspace_id uuid references public.workspaces,id_dummy text,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
 insert into auth.users(id) values('${ids.owner}'),('${ids.a}'),('${ids.b}');insert into public.workspaces values('${ids.workspace}');
 insert into public.workspace_members(workspace_id,user_id,role,is_active) values('${ids.workspace}','${ids.owner}','owner',true),('${ids.workspace}','${ids.a}','visitor',true),('${ids.workspace}','${ids.b}','visitor',true);`);
 await db.exec(migration);
 return db;
}

test('assignment generation rejects former reviewer and preserves work',async()=>{
 const db=await setup();
 try{
  for(const [user,n] of [[ids.a,1],[ids.b,2]])await db.query('select public.human_review_authorize_reviewer($1,$2,$3,$4,$5,$6)',[ids.workspace,ids.owner,user,'active',req(n),'authorized']);
  await db.query(`insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,created_by) values($1,$2,'batch','r1',$3,'Package',25,1,1,0,0,$4)`,[ids.pkg,ids.workspace,'a'.repeat(64),ids.owner]);
  await db.query(`insert into public.human_review_package_questions(package_id,question_id,position,source_revision,content_sha256,technical_status,question_payload) values($1,'q1',1,'r1',$2,'TECHNICALLY_VERIFIED','{"stem":"Question","options":[]}'::jsonb)`,[ids.pkg,'b'.repeat(64)]);
  const claimed=(await db.query('select public.human_review_claim_package($1,$2,$3,$4,$5) result',[ids.workspace,ids.pkg,ids.a,0,req(3)])).rows[0].result;
  assert.equal(claimed.assignmentGeneration,1);assert.equal(claimed.lockVersion,1);
  await assert.rejects(db.query('select public.human_review_claim_package($1,$2,$3,$4,$5)',[ids.workspace,ids.pkg,ids.b,0,req(4)]),/ALREADY_CLAIMED/);
  const saved=(await db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[ids.workspace,ids.pkg,'q1',ids.a,'APPROVED','checked',1,1,req(5)])).rows[0].result;
  assert.equal(saved.lockVersion,2);
  const moved=(await db.query('select public.human_review_transfer_package($1,$2,$3,$4,$5,$6,$7) result',[ids.workspace,ids.pkg,ids.owner,ids.b,2,req(6),'transfer'])).rows[0].result;
  assert.equal(moved.assignmentGeneration,2);assert.equal(moved.lockVersion,3);
  await assert.rejects(db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ids.workspace,ids.pkg,'q1',ids.a,'CORRECTION_REQUIRED','late',1,2,req(7)]),/NOT_ASSIGNED|STALE_WRITE/);
  let row=(await db.query('select reviewer_id,human_decision,note from public.human_question_reviews where package_id=$1',[ids.pkg])).rows[0];
  assert.deepEqual(row,{reviewer_id:ids.a,human_decision:'APPROVED',note:'checked'});
  const byB=(await db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[ids.workspace,ids.pkg,'q1',ids.b,'APPROVED','source checked',2,3,req(8)])).rows[0].result;
  assert.equal(byB.reviewRevision,2);assert.equal(byB.lockVersion,4);
  const duplicate=(await db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[ids.workspace,ids.pkg,'q1',ids.b,'APPROVED','source checked',2,3,req(8)])).rows[0].result;
  assert.equal(duplicate.duplicate,true);assert.equal((await db.query('select lock_version from public.human_review_packages where id=$1',[ids.pkg])).rows[0].lock_version,4);
  const submitted=(await db.query('select public.human_review_submit_package($1,$2,$3,$4,$5,$6) result',[ids.workspace,ids.pkg,ids.b,2,4,req(9)])).rows[0].result;
  assert.equal(submitted.status,'SUBMITTED_COMPLETE');assert.equal(submitted.packageComplete,true);
  const accepted=(await db.query('select public.human_review_owner_finalize_package($1,$2,$3,$4,$5,$6,$7) result',[ids.workspace,ids.pkg,ids.owner,'ACCEPTED','owner checked',5,req(10)])).rows[0].result;
  assert.equal(accepted.status,'OWNER_ACCEPTED');
  const ownerReview=(await db.query('select owner_decision,owner_id from public.human_question_reviews where package_id=$1',[ids.pkg])).rows[0];assert.deepEqual(ownerReview,{owner_decision:'ACCEPTED',owner_id:ids.owner});
  assert.equal(Number((await db.query('select count(*) n from public.human_review_audit where package_id=$1',[ids.pkg])).rows[0].n),6);
 }finally{await db.close()}
});

test('Owner manifest import derives present count and starts with no human decisions',async()=>{
 const db=await setup();
 try{
  const questions=[{question_id:'q-import',position:1,source_revision:'r1',content_sha256:'e'.repeat(64),technical_status:'TECHNICALLY_VERIFIED',question_payload:{stem:'Q'},evidence_payload:{page:3}}];
  const result=(await db.query('select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) result',[ids.workspace,ids.owner,'manifest-batch','r1','f'.repeat(64),'Imported package',25,2,1,0,JSON.stringify(questions),req(30)])).rows[0].result;
  assert.equal(result.presentCount,1);assert.equal(result.expectedCount,2);assert.equal(result.packageComplete,false);
  const pkg=(await db.query('select status,present_count,missing_count,package_complete from public.human_review_packages where id=$1',[result.packageId])).rows[0];assert.deepEqual(pkg,{status:'AVAILABLE',present_count:1,missing_count:1,package_complete:false});
  assert.equal(Number((await db.query('select count(*) n from public.human_question_reviews where package_id=$1',[result.packageId])).rows[0].n),0);
  const duplicate=(await db.query('select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) result',[ids.workspace,ids.owner,'manifest-batch','r1','f'.repeat(64),'Imported package',25,2,1,0,JSON.stringify(questions),req(30)])).rows[0].result;assert.equal(duplicate.duplicate,true);
  await assert.rejects(db.query('select public.human_review_import_package($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)',[ids.workspace,ids.owner,'bad-count','r1','a'.repeat(64),'Bad',25,2,0,0,JSON.stringify(questions),req(31)]),/COUNT_MISMATCH/);
 }finally{await db.close()}
});

test('emergency rollback disables mutations and preserves evidence',async()=>{
 const db=await setup();
 try{
  await db.query(`insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,created_by) values($1,$2,'rollback','r1',$3,'Preserve',25,1,1,0,0,$4)`,[ids.pkg,ids.workspace,'9'.repeat(64),ids.owner]);
  await db.exec(rollback);
  assert.equal(Number((await db.query('select count(*) n from public.human_review_packages where id=$1',[ids.pkg])).rows[0].n),1);
  const privilege=(await db.query("select has_function_privilege('service_role','public.human_review_claim_package(uuid,uuid,uuid,bigint,uuid)','EXECUTE') allowed")).rows[0].allowed;assert.equal(privilege,false);
 }finally{await db.close()}
});

test('missing questions stay explicitly incomplete and revoked reviewers are denied',async()=>{
 const db=await setup();
 try{
  await db.query('select public.human_review_authorize_reviewer($1,$2,$3,$4,$5,$6)',[ids.workspace,ids.owner,ids.a,'active',req(20),'authorized']);
  await db.query(`insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,created_by) values($1,$2,'incomplete','r1',$3,'Incomplete',25,2,1,1,0,$4)`,[ids.pkg2,ids.workspace,'c'.repeat(64),ids.owner]);
  await db.query(`insert into public.human_review_package_questions(package_id,question_id,position,source_revision,content_sha256,technical_status,question_payload) values($1,'q1',1,'r1',$2,'TECHNICALLY_VERIFIED','{}'::jsonb)`,[ids.pkg2,'d'.repeat(64)]);
  await db.query('select public.human_review_claim_package($1,$2,$3,$4,$5)',[ids.workspace,ids.pkg2,ids.a,0,req(21)]);
  await db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ids.workspace,ids.pkg2,'q1',ids.a,'APPROVED','',1,1,req(22)]);
  const result=(await db.query('select public.human_review_submit_package($1,$2,$3,$4,$5,$6) result',[ids.workspace,ids.pkg2,ids.a,1,2,req(23)])).rows[0].result;
  assert.equal(result.status,'SUBMITTED_INCOMPLETE');assert.equal(result.packageComplete,false);
  await db.query('select public.human_review_authorize_reviewer($1,$2,$3,$4,$5,$6)',[ids.workspace,ids.owner,ids.a,'revoked',req(24),'revoked']);
  await assert.rejects(db.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ids.workspace,ids.pkg2,'q1',ids.a,'APPROVED','',1,3,req(25)]),/REVIEWER_REQUIRED|NOT_ASSIGNED/);
  await assert.rejects(db.query('update public.human_review_audit set action=action'),/IMMUTABLE/);
 }finally{await db.close()}
});

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
const migration=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260906000100_academy_ism_flag_dimension.sql'),'utf8');

const ids={
 workspace:'11111111-1111-4111-8111-111111111111',
 owner:'22222222-2222-4222-8222-222222222222',
 developer:'99999999-9999-4999-8999-999999999999',
 student:'33333333-3333-4333-8333-333333333333',
 otherStudent:'44444444-4444-4444-8444-444444444444',
};

async function setup(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);
 create table public.workspaces(id uuid primary key);
 create type public.workspace_role as enum('owner','developer','visitor');
 create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));
 insert into auth.users(id) values('${ids.owner}'),('${ids.developer}'),('${ids.student}'),('${ids.otherStudent}');
 insert into public.workspaces values('${ids.workspace}');
 insert into public.workspace_members(workspace_id,user_id,role,is_active) values
   ('${ids.workspace}','${ids.owner}','owner',true),
   ('${ids.workspace}','${ids.developer}','developer',true),
   ('${ids.workspace}','${ids.student}','visitor',true),
   ('${ids.workspace}','${ids.otherStudent}','visitor',true);
 grant select on public.workspaces,public.workspace_members to anon,authenticated;`);
 await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$
   select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
 $$;
 grant usage on schema auth to anon, authenticated;`);
 await db.exec(humanReviewMigration);
 await db.exec(migration);
 // Supabase provisions every project with baseline table grants to anon/authenticated at
 // the platform level (this never appears in application migrations); RLS policies, plus a
 // migration's own revokes, are what actually narrow access from there. This bare fixture
 // has no platform bootstrap, so the baseline grant is modelled explicitly here, and the
 // migration's own revokes (identical to what is already inside the .sql file) are re-run
 // immediately after so they remain the final, authoritative word on write access.
 await db.exec(`grant select,insert on public.academy_flag_administrations,public.academy_ism_source_manifest,public.academy_ism_source_chunks,public.academy_ism_questions,public.academy_ism_attempts,public.academy_ism_mastery,public.academy_ism_readiness to anon,authenticated;
 revoke insert,update,delete on public.academy_flag_administrations from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_source_manifest from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_source_chunks from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_questions from anon,authenticated;
 revoke update,delete on public.academy_ism_attempts from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_mastery from anon,authenticated;
 revoke insert,update,delete on public.academy_ism_readiness from anon,authenticated;`);
 return db;
}

const asUser=userId=>`select set_config('request.jwt.claim.sub','${userId}',true);set local role authenticated;`;

test('flag administrations seed with UK MCA active and the others planned, and only reference-table shape',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  const rows=(await db.query('select code,status from public.academy_flag_administrations order by code')).rows;
  assert.deepEqual(rows,[
   {code:'CAYMAN',status:'planned'},
   {code:'MALTA',status:'planned'},
   {code:'MARSHALL_ISLANDS',status:'planned'},
   {code:'UK_MCA',status:'active'},
  ]);
 }finally{await db.close();}
});

test('a new flag administration is a data insert, not a schema change',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await db.query(`insert into public.academy_flag_administrations(code,name,status) values('PANAMA','Panama Maritime Authority','planned')`);
  assert.equal((await db.query(`select status from public.academy_flag_administrations where code='PANAMA'`)).rows[0].status,'planned');
 }finally{await db.close();}
});

async function seedManifestAndQuestions(db){
 await db.query(`insert into public.academy_ism_source_manifest(id,workspace_id,source_id,title,authority,flag_administration,module_code,version,content_sha256,verification_stage,created_by) values
   ('55555555-5555-4555-8555-000000000001','${ids.workspace}','imo-ism-code','ISM Code','IMO',null,'ism-code-foundations','2024',repeat('a',64),'HUMAN_REVIEW_ACCEPTED','${ids.owner}'),
   ('55555555-5555-4555-8555-000000000002','${ids.workspace}','uk-mca-msn-1','UK MCA MSN circular','UK MCA','UK_MCA','ism-code-foundations','2024',repeat('b',64),'HUMAN_REVIEW_ACCEPTED','${ids.owner}'),
   ('55555555-5555-4555-8555-000000000003','${ids.workspace}','draft-source','Draft candidate','IMO',null,'ism-code-foundations','2024',repeat('c',64),'UNVERIFIED_CANDIDATE','${ids.owner}')`);
 await db.query(`insert into public.academy_ism_questions(id,workspace_id,question_id,module_code,flag_administration,learning_objective,difficulty,competency_dimension,source_manifest_id,source_version,question_kind,prompt,correct_answer,marking_rubric,pass_threshold,verification_stage,created_by) values
   ('66666666-6666-4666-8666-000000000001','${ids.workspace}','ISM-M1-001','ism-code-foundations',null,'Explain Element 4','foundation','ism_knowledge','55555555-5555-4555-8555-000000000001','2024','multiple_choice','What does Element 4 require?','"C"'::jsonb,'{"keys":["safety","policy"]}'::jsonb,0.7,'HUMAN_REVIEW_ACCEPTED','${ids.owner}'),
   ('66666666-6666-4666-8666-000000000002','${ids.workspace}','ISM-M1-DRAFT-001','ism-code-foundations',null,'Draft unreleased question','foundation','ism_knowledge','55555555-5555-4555-8555-000000000003','2024','multiple_choice','Unverified draft prompt','"A"'::jsonb,'{}'::jsonb,0.7,'UNVERIFIED_CANDIDATE','${ids.owner}')`);
}

test('students can only ever read HUMAN_REVIEW_ACCEPTED questions and sources; owners and developers see every stage',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await seedManifestAndQuestions(db);
  const studentVisible=(await db.exec(`${asUser(ids.student)} select question_id from public.academy_ism_questions order by question_id;`))[2].rows;
  assert.deepEqual(studentVisible,[{question_id:'ISM-M1-001'}]);
  const ownerVisible=(await db.exec(`${asUser(ids.owner)} select question_id from public.academy_ism_questions order by question_id;`))[2].rows;
  assert.deepEqual(ownerVisible,[{question_id:'ISM-M1-001'},{question_id:'ISM-M1-DRAFT-001'}]);
  const developerVisible=(await db.exec(`${asUser(ids.developer)} select question_id from public.academy_ism_questions order by question_id;`))[2].rows;
  assert.equal(developerVisible.length,2);
  const studentManifest=(await db.exec(`${asUser(ids.student)} select source_id from public.academy_ism_source_manifest order by source_id;`))[2].rows;
  assert.deepEqual(studentManifest,[{source_id:'imo-ism-code'},{source_id:'uk-mca-msn-1'}]);
 }finally{await db.close();}
});

test('students cannot write questions or source manifest rows directly',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await seedManifestAndQuestions(db);
  await db.exec(`${asUser(ids.student)}
  do $$ begin
    insert into public.academy_ism_questions(workspace_id,question_id,module_code,learning_objective,difficulty,competency_dimension,source_manifest_id,source_version,question_kind,prompt,correct_answer,marking_rubric,pass_threshold,created_by)
    values('${ids.workspace}','ISM-M1-999','ism-code-foundations','x','foundation','ism_knowledge','55555555-5555-4555-8555-000000000001','2024','multiple_choice','x','"A"'::jsonb,'{}'::jsonb,0.7,'${ids.student}');
    raise exception 'STUDENT_COULD_INSERT_QUESTION';
  exception when insufficient_privilege then null; end $$;`);
 }finally{await db.close();}
});

test('attempts are private per student; not visible to other students, owner or developer',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await seedManifestAndQuestions(db);
  await db.exec(`${asUser(ids.student)}
  insert into public.academy_ism_attempts(workspace_id,user_id,question_id,response,is_correct)
  values('${ids.workspace}','${ids.student}','66666666-6666-4666-8666-000000000001','"C"'::jsonb,true);`);
  const ownAttempts=(await db.exec(`${asUser(ids.student)} select is_correct from public.academy_ism_attempts;`))[2].rows;
  assert.deepEqual(ownAttempts,[{is_correct:true}]);
  const otherStudentView=(await db.exec(`${asUser(ids.otherStudent)} select is_correct from public.academy_ism_attempts;`))[2].rows;
  assert.deepEqual(otherStudentView,[]);
  const ownerView=(await db.exec(`${asUser(ids.owner)} select is_correct from public.academy_ism_attempts;`))[2].rows;
  assert.deepEqual(ownerView,[]);
  await db.exec(`${asUser(ids.student)}
  do $$ begin
    insert into public.academy_ism_attempts(workspace_id,user_id,question_id,response)
    values('${ids.workspace}','${ids.otherStudent}','66666666-6666-4666-8666-000000000001','"C"'::jsonb);
    raise exception 'STUDENT_COULD_FORGE_ANOTHER_USERS_ATTEMPT';
  exception when others then
    if sqlerrm not like '%new row violates row-level security%' then raise; end if;
  end $$;`);
 }finally{await db.close();}
});

test('mastery and readiness reject direct client writes; only a privileged/service role can ever populate them',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await db.exec(`${asUser(ids.student)}
  do $$ begin
    insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,mastery_level) values('${ids.workspace}','${ids.student}','ism_knowledge','READY');
    raise exception 'STUDENT_COULD_SET_OWN_MASTERY';
  exception when insufficient_privilege then null; end $$;
  do $$ begin
    insert into public.academy_ism_readiness(workspace_id,user_id,competency_dimension,readiness_state) values('${ids.workspace}','${ids.student}','ism_knowledge','READY');
    raise exception 'STUDENT_COULD_SET_OWN_READINESS';
  exception when insufficient_privilege then null; end $$;`);
 }finally{await db.close();}
});

test('mastery is unique per core dimension and independently unique per flag, without a NOT NULL flag column',{skip:!runtimeAvailable},async()=>{
 const db=await setup();
 try{
  await db.query(`insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration,mastery_level) values('${ids.workspace}','${ids.student}','flag_ro_understanding',null,'DEVELOPING')`);
  await db.query(`insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration,mastery_level) values('${ids.workspace}','${ids.student}','flag_ro_understanding','UK_MCA','NEAR_READY')`);
  await db.query(`insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration,mastery_level) values('${ids.workspace}','${ids.student}','flag_ro_understanding','CAYMAN','NOT_ASSESSED')`);
  const rows=(await db.query(`select flag_administration,mastery_level from public.academy_ism_mastery where user_id='${ids.student}' order by flag_administration nulls first`)).rows;
  assert.deepEqual(rows,[
   {flag_administration:null,mastery_level:'DEVELOPING'},
   {flag_administration:'CAYMAN',mastery_level:'NOT_ASSESSED'},
   {flag_administration:'UK_MCA',mastery_level:'NEAR_READY'},
  ]);
  await assert.rejects(db.query(`insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration,mastery_level) values('${ids.workspace}','${ids.student}','flag_ro_understanding',null,'READY')`),/duplicate key|unique/i);
  await assert.rejects(db.query(`insert into public.academy_ism_mastery(workspace_id,user_id,competency_dimension,flag_administration,mastery_level) values('${ids.workspace}','${ids.student}','flag_ro_understanding','UK_MCA','READY')`),/duplicate key|unique/i);
 }finally{await db.close();}
});

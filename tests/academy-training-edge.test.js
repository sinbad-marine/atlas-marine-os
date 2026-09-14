'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/academy-training/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260914000100_academy_owner_private_training.sql','utf8');
const humanReview=fs.readFileSync('supabase/migrations/20260903000400_human_reviewer_system.sql','utf8');

test('academy-training API uses exact origins, bearer validation and server-derived identity',()=>{
 assert.match(edge,/ACADEMY_TRAINING_ALLOWED_ORIGINS/);assert.match(edge,/allowedOrigins\.has\(value\)/);assert.match(edge,/userClient\.auth\.getUser\(jwt\)/);
 assert.doesNotMatch(edge,/body\.userId/);assert.doesNotMatch(edge,/body\.role/);
});
test('promotion is Owner-only, AAL2 step-up consumed, single action, database RPC',()=>{
 assert.match(edge,/member\.role!=='owner'\)return respond\(origin,403,\{error:'OWNER_REQUIRED'\}\)/);
 assert.match(edge,/getAuthenticatorAssuranceLevel/);assert.match(edge,/consume_founder_step_up/);assert.match(edge,/identity\.academy\.training_promote/);
 assert.match(edge,/admin\.rpc\('academy_ism_owner_promote_training'/);
 assert.equal((edge.match(/if\(action==='/g)||[]).length,1,'exactly one action');
 assert.doesNotMatch(edge,/human_review_(claim|save|submit|owner_finalize|import)/,'no Human Review mutation is reachable from the training function');
});
test('API maps database errors to bounded codes and never echoes raw messages',()=>{
 assert.match(edge,/safeCodes/);assert.match(edge,/databaseCode/);assert.doesNotMatch(edge,/error\.message\}\)/);
});
test('migration separates training scope from verification stage and keeps Human Review objects untouched',()=>{
 assert.match(migration,/training_scope text not null default 'NONE'/);assert.match(migration,/check \(training_scope in \('NONE','OWNER_ONLY'\)\)/);
 assert.match(migration,/'TECHNICALLY_VERIFIED','HUMAN_REVIEW_ACCEPTED'/);
 assert.match(migration,/create policy "owner reads owner-only training questions"/);
 assert.doesNotMatch(migration,/alter table public\.human_review_/);assert.doesNotMatch(migration,/insert into public\.human_review_/);assert.doesNotMatch(migration,/update public\.human_review_/);
 assert.doesNotMatch(migration,/drop policy if exists "members read accepted questions"/,'existing member policy stays');
 assert.match(migration,/grant execute on function public\.academy_ism_owner_promote_training\(uuid,uuid,uuid,text,uuid\) to service_role;/);
 assert.match(migration,/revoke all on function public\.academy_ism_submit_attempt\(uuid,uuid,jsonb\) from public,anon;/);
});
test('promotion requires TECHNICALLY_VERIFIED source state and records provenance, actor and time',()=>{
 assert.match(migration,/technical_status<>'TECHNICALLY_VERIFIED' then raise exception 'ACADEMY_TRAINING_NOT_TECHNICALLY_VERIFIED'/);
 for(const column of ['review_package_id','source_content_sha256','training_promoted_by','training_promoted_at'])assert.match(migration,new RegExp(column));
 assert.match(humanReview,/technical_status text not null/);
});

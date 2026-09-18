'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const html=fs.readFileSync('academy.html','utf8'),js=fs.readFileSync('academy-owner-training.js','utf8'),pages=fs.readFileSync('tools/build-pages-artifact.js','utf8');

test('classroom hosts the Owner-private training panel hidden by default and loads the auth modules after the classroom script',()=>{
 assert.match(html,/id="academyOwnerTraining"[^>]*hidden/);
 const order=['academy-classroom-window.js','vendor/supabase-2.112.3.js','founder-owner-mfa.js','founder-owner-ui.js','academy-owner-training.js'].map(f=>html.indexOf(f));
 assert.deepEqual([...order].sort((a,b)=>a-b),order);assert.ok(order.every(i=>i>0));
 assert.match(pages,/'academy-owner-training\.js'/,'Pages allowlist includes the module');
});
test('panel is bound to the ISM Code foundations module only and never renders public content',()=>{
 assert.match(js,/MODULE='ism-code-foundations'/);assert.match(js,/root\.hidden=!visible\(\)/);
 assert.match(js,/\.eq\('training_scope','OWNER_ONLY'\)/);assert.match(js,/\.eq\('workspace_id',workspace\(\)\)/);
 assert.doesNotMatch(js,/innerHTML/);assert.doesNotMatch(js,/service_role/i);
});
test('correct answer and reasoning are only shown from the server-side attempt result',()=>{
 assert.match(js,/client\.rpc\('academy_ism_submit_attempt'/);
 assert.doesNotMatch(js,/correct_answer/,'the client never selects or renders correct_answer');
 assert.doesNotMatch(js,/expected_reasoning/,'the client never selects expected_reasoning');
 assert.match(js,/data\.correctKey/);assert.match(js,/data\.expectedReasoning/);
});
test('promotion uses the exact Owner step-up descriptor, fresh request id and the academy-training function',()=>{
 assert.match(js,/identity\.academy\.training_promote/);assert.match(js,/requestId=crypto\.randomUUID\(\)/);assert.match(js,/functions\.invoke\('academy-training'/);
 assert.match(js,/ownerSecurity\.authorize\(descriptor/);
});
test('attempts read-back is scoped to the signed-in user by RLS, not by client filtering on user id',()=>{
 assert.match(js,/from\('academy_ism_attempts'\)/);assert.doesNotMatch(js,/\.eq\('user_id'/);
});

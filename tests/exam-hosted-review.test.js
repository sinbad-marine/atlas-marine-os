const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const migration=fs.readFileSync('supabase/migrations/20260829_developer_owner_approval_workflow.sql','utf8');
const edge=fs.readFileSync('supabase/functions/exam-answer-key-review/index.ts','utf8');
const html=fs.readFileSync('exam-review.html','utf8'),client=fs.readFileSync('exam-review.js','utf8');
const launcher=fs.readFileSync('sinbad-owner-review.js','utf8'),builder=fs.readFileSync('tools/build-pages-artifact.js','utf8');

test('hosted Owner review uses the same-origin authenticated surface instead of loopback',()=>{assert.match(launcher,/new URL\('\.\/exam-review\.html',runtimeUrl\)/);assert.doesNotMatch(html,/127\.0\.0\.1:4177/);assert.match(client,/auth\.getSession\(\)/);assert.match(client,/functions\.invoke\('exam-answer-key-review'/)});
test('secret answer material has no browser policy and is absent from the Pages client',()=>{assert.match(migration,/exam_answer_key_materials enable row level security/);assert.match(migration,/revoke all on public\.exam_answer_key_materials from anon,authenticated/);assert.doesNotMatch(`${html}\n${client}`,/answer-key\.owner\.json|SUPABASE_SERVICE_ROLE_KEY/);assert.match(builder,/'exam-review\.html','exam-review\.css','exam-review\.js'/)});
test('Edge Function authenticates users, restricts origins and verifies active workspace roles',()=>{assert.match(edge,/EXAM_REVIEW_ALLOWED_ORIGINS/);assert.match(edge,/userClient\.auth\.getUser\(\)/);assert.match(edge,/workspace_members/);assert.match(edge,/\['owner','developer'\]\.includes\(member\.role\)/);assert.match(edge,/role!==\'developer\'/);assert.match(edge,/role!==\'owner\'/)});
test('Developer and Owner decisions are atomic database gates and never directly publish',()=>{assert.match(migration,/exam_developer_decide/);assert.match(migration,/m\.role='developer'/);assert.match(migration,/exam_owner_finalize/);assert.match(migration,/m\.role='owner'/);assert.match(migration,/Developer approval is required before Owner final approval/);assert.match(edge,/published:false/);assert.doesNotMatch(edge,/deploy|github|pages-release/)});

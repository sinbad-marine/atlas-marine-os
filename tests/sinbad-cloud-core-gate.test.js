const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const edge=fs.readFileSync(path.join(root,'supabase/functions/sinbad-answer/index.ts'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('cloud AI rejects a missing or inconsistent Core safety envelope before provider use',()=>{
  const validation=edge.indexOf("if (!validateCoreEnvelope(coreEnvelope, question))");
  const provider=edge.indexOf("fetch('https://api.openai.com/v1/responses'");
  assert.ok(validation>=0);
  assert.ok(provider>validation);
  assert.match(edge,/CORE_GATE_BLOCKED/);
  assert.match(edge,/serverCoreDecision\(question\)/);
});

test('normal and consented web AI requests both carry a Core envelope',()=>{
  const invocations=[...app.matchAll(/functions\.invoke\('sinbad-answer',[\s\S]{0,260}?coreEnvelope/g)];
  assert.equal(invocations.length,2);
});

test('cloud answers cannot claim execution authority',()=>{
  assert.match(edge,/const decisionSupport = \{ coreDecision, permission: 'DECISION_SUPPORT_ONLY', executionPerformed: false \}/);
  assert.ok((edge.match(/\.\.\.decisionSupport/g)||[]).length>=4);
});

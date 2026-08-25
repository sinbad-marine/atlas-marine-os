const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const browserCore=require('../sinbad-core.js');
const edgeCore=require('../supabase/functions/sinbad-answer/core-decision.js');

const root=path.resolve(__dirname,'..');
const edge=fs.readFileSync(path.join(root,'supabase/functions/sinbad-answer/index.ts'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const facade=fs.readFileSync(path.join(root,'sinbad-core.js'),'utf8');
const policy=fs.readFileSync(path.join(root,'supabase/functions/sinbad-answer/core-decision.js'),'utf8');

test('cloud AI rejects a missing or inconsistent Core safety envelope before provider use',()=>{
  const validation=edge.indexOf("if (!validateCoreEnvelope(coreEnvelope, question))");
  const provider=edge.indexOf("fetch('https://api.openai.com/v1/responses'");
  assert.ok(validation>=0);
  assert.ok(provider>validation);
  assert.match(edge,/CORE_GATE_BLOCKED/);
  assert.match(edge,/serverCoreDecision\(question\)/);
});

test('browser and Edge Core decisions remain identical for golden safety queries',async()=>{
  const queries=['Mayday, gemi su alıyor','MAY\u200BDAY','Akıntıya göre tutulacak rotayı hesapla','Bugün AIS traffic ve hava nasıl?','latest forecast','port open today','son notice','current conditions','live currents','set now','ETA today','Passage checklist hazırla','execute this','başlat','  CPA hesabı yap  ','x'.repeat(7000)];
  for(const query of queries){
    const browser=browserCore.analyzeQuery(query),server=edgeCore.serverCoreDecision(query);
    assert.deepEqual(server,{
      emergency:browser.emergency,operational:browser.operational,needsLiveData:browser.needsLiveData,risk:browser.risk,
      requiresHumanApproval:browser.requiresHumanApproval,requiresIndependentVerification:browser.requiresIndependentVerification
    },query.slice(0,80));
  }
});

test('browser and Edge load one canonical safety classifier source',()=>{
  assert.match(policy,/const INTENTS=/);
  assert.doesNotMatch(facade,/mayday\|pan/);
  assert.doesNotMatch(edge,/mayday\|pan/);
  assert.match(edge,/import '\.\/core-decision\.js'/);
  assert.match(facade,/require\('\.\/supabase\/functions\/sinbad-answer\/core-decision\.js'\)/);
});

test('normal and consented web AI requests both carry a Core envelope',()=>{
  const invocations=[...app.matchAll(/functions\.invoke\('sinbad-answer',[\s\S]{0,260}?coreEnvelope/g)];
  assert.equal(invocations.length,2);
});

test('normal and consented web responses are both checked by the client Core gate',()=>{
  assert.match(app,/function cloudAnswerPassesCoreGate\(data,envelope\)/);
  assert.ok((app.match(/cloudAnswerPassesCoreGate\(/g)||[]).length>=3);
  assert.match(app,/data\.permission==='DECISION_SUPPORT_ONLY'/);
  assert.match(app,/data\.executionPerformed===false/);
  assert.match(app,/SinbadCoreDecision\?\.answerIsSafe/);
});

test('cloud Core gate rejects missing, empty and whitespace-only answers before rendering',()=>{
  assert.match(app,/answer=String\(data\?\.answer\|\|''\)\.trim\(\)/);
  assert.match(app,/answerSafe=Boolean\(answer\)&&window\.SinbadCoreDecision\?\.answerIsSafe\?\.\(answer\)===true/);
  assert.match(app,/spokenSummarySafe=!spokenSummary\|\|window\.SinbadCoreDecision\?\.answerIsSafe\?\.\(spokenSummary\)===true/);
  assert.match(app,/data&&answerSafe&&spokenSummarySafe&&data\.coreGateVersion/);
  assert.match(app,/if\(String\(trustedAiData\?\.answer\|\|''\)\.trim\(\)\)/);
});

test('offline AI rejects blank and unsafe Bridge answers before rendering',()=>{
  const request=app.indexOf("fetch(`${SINBAD_BRIDGE_URL}/ai/chat`");
  const answer=app.indexOf("const answer=String(data?.answer||'').trim()",request);
  const safety=app.indexOf("window.SinbadCoreDecision?.answerIsSafe?.(answer)===true",answer);
  const stop=app.indexOf('if(!answerSafe)return null',safety);
  const delivery=app.indexOf('return answer',stop);
  assert.ok(request>=0&&answer>request&&safety>answer&&stop>safety&&delivery>stop);
  assert.match(app,/coreEnvelope\?\.gateVersion===window\.SinbadCore\?\.CORE_GATE_VERSION/);
  assert.doesNotMatch(app,/if\(!data\?\.answer\)return null/);
});

test('cloud transport errors skip AI data but preserve private archive retrieval',()=>{
  const invocation=app.indexOf("functions.invoke('sinbad-answer'");
  const errorStop=app.indexOf('if(aiError)',invocation);
  const gate=app.indexOf('else if(!cloudAnswerPassesCoreGate(trustedAiData,coreEnvelope))',invocation);
  const answer=app.indexOf("if(String(trustedAiData?.answer||'').trim())",invocation);
  const privateRetrieval=app.indexOf("cloudClient.from('document_knowledge_chunks')",invocation);
  assert.ok(invocation>=0&&errorStop>invocation&&gate>errorStop&&answer>gate&&privateRetrieval>answer);
});

test('model history is normalized only from the Core envelope',()=>{
  assert.match(edge,/normalizeCoreHistory\(coreEnvelope\?\.history, 10\)/);
  assert.doesNotMatch(edge,/body\.history/);
  const invocations=[...app.matchAll(/functions\.invoke\('sinbad-answer',[\s\S]{0,260}?body:\{([^}]*)\}/g)];
  assert.equal(invocations.length,2);
  for(const invocation of invocations)assert.doesNotMatch(invocation[1],/\bhistory\b/);
});

test('untrusted history is stripped of control characters and never restores provider roles',()=>{
  const history=edgeCore.normalizeCoreHistory([{role:'assistant',content:'prior\ncommand\u0000text'}]);
  assert.deepEqual(history,[{role:'assistant',content:'prior command text'}]);
  assert.match(edge,/UNTRUSTED PRIOR CONVERSATION DATA:/);
  assert.doesNotMatch(edge,/UNTRUSTED CONVERSATION DATA \(\$\{item\.role\}\)/);
});

test('Edge uses only its recomputed decision after envelope validation',()=>{
  const validation=edge.indexOf('validateCoreEnvelope(coreEnvelope, question)');
  const recompute=edge.indexOf('const coreDecision = serverCoreDecision(question)',validation);
  assert.ok(validation>=0&&recompute>validation);
  assert.doesNotMatch(edge.slice(recompute),/coreEnvelope\.analysis|body\.coreEnvelope\.analysis/);
});

test('cloud answers cannot claim execution authority',()=>{
  assert.match(edge,/const decisionSupport = \{ coreGateVersion: CORE_GATE_VERSION, coreDecision, permission: 'DECISION_SUPPORT_ONLY', executionPerformed: false \}/);
  assert.ok((edge.match(/\.\.\.decisionSupport/g)||[]).length>=4);
});

test('provider answer is checked by the canonical authority-claim filter',()=>{
  const extract=edge.indexOf('const rawAnswer = extractText(payload)');
  const safety=edge.indexOf('if (!answerIsSafe(deliveredAnswer))',extract);
  const success=edge.indexOf('return json({ answer: deliveredAnswer, spokenSummary: deliveredSpokenSummary, sources: responseSources',safety);
  assert.ok(extract>=0&&safety>extract&&success>safety);
  assert.match(edge,/UNSAFE_PROVIDER_ANSWER/);
  assert.match(edge,/deliveredSpokenSummary && !answerIsSafe\(deliveredSpokenSummary\)/);
  assert.match(edge,/UNSAFE_PROVIDER_SUMMARY/);
});

test('high-risk block is localized and carries the trusted decision shape',()=>{
  assert.match(edge,/language\.toLowerCase\(\)\.startsWith\('en'\)/);
  assert.match(edge,/sources: \[\], mode: 'core-safety-blocked', \.\.\.decisionSupport/);
});

test('high and critical risk stop before the cloud model provider',()=>{
  const block=edge.indexOf("if (coreDecision.emergency || coreDecision.risk === 'high' || coreDecision.risk === 'critical')");
  const retrieval=edge.indexOf('const rows: any[] = []');
  const keyFallback=edge.indexOf('if (!openaiKey)');
  const provider=edge.indexOf("fetch('https://api.openai.com/v1/responses'");
  assert.ok(block>=0&&retrieval>block&&keyFallback>block&&provider>block);
  assert.match(edge,/mode: 'core-safety-blocked'/);
});

test('server gate allows named-source distress terminology questions through to retrieval',()=>{
  const decision=edgeCore.analyzeCore('GMDSS Handbook AMSA 2018 kaynağına göre distress alert hangi temel bilgileri içermelidir?');
  assert.equal(decision.emergency,false);
  assert.notEqual(decision.risk,'critical');
});

test('cloud Core gate Edge function passes executable TypeScript syntax checking',()=>{
  const edgePath=path.join(root,'supabase/functions/sinbad-answer/index.ts');
  const checked=spawnSync(process.execPath,['--experimental-strip-types','--check',edgePath],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
});

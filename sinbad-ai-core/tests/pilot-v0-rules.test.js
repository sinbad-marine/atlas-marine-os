'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {p,context,ITEMS,set,claim,citation,action,draft,run,asks}=require('./helpers/pilot-v0-builders.js');
const TEXT='The state file records the phase.';
const supported=changes=>draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],...changes});
const invention=draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]});
const vague=draft({claims:[claim('c1',{text:'The bridge probably scans the whole library.'})]});
const voice=supported({claims:[claim('c1',{text:'As the owner I accept the record.',evidenceIds:['ev-repo']})]});
const granted=context({authorityRefs:['grant-1']});
const write=changes=>action('w',{actionClass:'WRITE',protected:true,...changes});

test('PROCEED: an admitted draft proceeds with or without a review; an authorized protected action proceeds only with a clean verdict',()=>{
  for(const d of [run({draft:supported()}),run({draft:supported(),withReview:false}),run(),run({context:granted,draft:supported({proposedActions:[write({authorityRef:'grant-1'})]})})]){assert.equal(d.decision,'PROCEED');assert.equal(d.reasonCode,'ALL_CLEAR');assert.deepEqual([...d.findings],[]);}
  const noVerdict=run({context:granted,withReview:false,draft:supported({proposedActions:[write({authorityRef:'grant-1'})]})});
  assert.equal(noVerdict.decision,'STOP');assert.equal(noVerdict.reasonCode,'VERDICT_REQUIRED_FOR_PROTECTED_ACTION');assert.equal(noVerdict.ruleId,'PILOT.PIPELINE_TRUSTED');
});

test('REVISE_DRAFT: what the draft must not say - confident invention, fabricated citation, foreign claim, authority voice - is sent back, and outranks evidence requests',()=>{
  const invented=run({draft:invention});
  assert.equal(invented.decision,'REVISE_DRAFT');assert.equal(invented.ruleId,'PILOT.DRAFT_ACCEPTABLE');assert.equal(invented.reasonCode,'DRAFT_FINDINGS');assert.deepEqual([...invented.carryLabels],[]);
  assert.deepEqual(asks(invented),['GATE.SPECIFICITY_SUPPORTED>REVISE_DRAFT','GATE.VOCABULARY_BOUND>REVISE_DRAFT','GATE.CLAIMS_SUPPORTED>REQUEST_EVIDENCE','GATE.PROVENANCE_ADEQUATE>REQUEST_EVIDENCE','UNSUPPORTED_FACTUAL_ASSERTION>REQUEST_EVIDENCE','FALSE_CERTAINTY>REVISE_DRAFT']);
  assert.deepEqual(invented.findings[0],{source:'GATE_RULE',ref:'GATE.SPECIFICITY_SUPPORTED',asks:'REVISE_DRAFT',blocking:true,detailRef:'claims:c1'});
  assert.deepEqual(asks(run({draft:supported({citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-nope')]})})),['GATE.CITATIONS_IN_EVIDENCE>REVISE_DRAFT','SOURCE_EVIDENCE_MISMATCH>REVISE_DRAFT']);
  const foreign=run({evidenceSet:set([ITEMS.repo,ITEMS.foreign]),draft:draft({claims:[claim('c1',{text:'The other task finished.',originRef:'turn:other',originScopeRef:'scope:beta',evidenceIds:['ev-foreign']})]})});
  assert.equal(foreign.decision,'REVISE_DRAFT');assert.ok(asks(foreign).includes('GATE.FOREIGN_CLAIMS_EXCLUDED>REVISE_DRAFT'));
  // A Co-Pilot-only finding: the gate merely labels a read-only draft, the Pilot still sends it back because the warning is BLOCKING.
  const readOnly=run({draft:voice});assert.equal(readOnly.gate.outcome,'LABEL');assert.equal(readOnly.decision,'REVISE_DRAFT');assert.deepEqual(asks(readOnly),['ROLE_CONFUSION>REVISE_DRAFT']);assert.equal(readOnly.findings[0].detailRef,'claim:c1:authority-voice');
  assert.equal(run({context:granted,draft:{...voice,proposedActions:[write({authorityRef:'grant-1'})]}}).decision,'REVISE_DRAFT');
});

test('REQUEST_EVIDENCE: a draft that may be right but is not supported yet - volatile claim from a document, stale or missing evidence',()=>{
  const volatile=run({draft:supported({claims:[claim('c1',{text:'The bridge is currently listening on the loopback port.',evidenceIds:['ev-repo']})]})});
  assert.equal(volatile.decision,'REQUEST_EVIDENCE');assert.equal(volatile.ruleId,'PILOT.EVIDENCE_SUFFICIENT');assert.equal(volatile.reasonCode,'EVIDENCE_FINDINGS');assert.deepEqual(asks(volatile),['GATE.VOLATILE_CLAIMS_LIVE>REQUEST_EVIDENCE']);
  const improve={policy:{maxIterations:3,labelledDelivery:'IMPROVE'}};
  const stale={evidenceSet:set([ITEMS.repo,ITEMS.stale]),draft:draft({claims:[claim('c1',{text:'Row one holds the value.',evidenceIds:['ev-stale']})],citations:[citation('cit-1','ev-stale')]})};
  assert.equal(run(stale,improve).decision,'REQUEST_EVIDENCE');assert.ok(asks(run(stale,improve)).includes('GATE.EVIDENCE_FRESH>REQUEST_EVIDENCE'));
  assert.equal(run({evidenceSet:null,draft:draft({claims:[claim('c1',{text:'Plain statement.',evidenceIds:['ev-repo']})]})},improve).decision,'REQUEST_EVIDENCE');
});

test('labelled delivery: honest uncertainty proceeds with its labels under PROCEED policy; under IMPROVE it is sent back while the budget lasts, then proceeds labelled',()=>{
  const now=run({draft:vague});
  assert.equal(now.decision,'PROCEED');assert.equal(now.reasonCode,'LABELLED_DELIVERY_ADMITTED');assert.deepEqual([...now.carryLabels],['NOT_VERIFIED','SOURCE_MISSING']);assert.ok(now.findings.length>0&&now.findings.every(f=>!f.blocking));
  const improve=run({draft:vague},{policy:{maxIterations:3,labelledDelivery:'IMPROVE'}});
  assert.equal(improve.decision,'REQUEST_EVIDENCE');assert.equal(improve.reasonCode,'EVIDENCE_FINDINGS_BEFORE_LABELLED_DELIVERY');assert.deepEqual([...improve.carryLabels],[]);
  const last=run({draft:vague},{iterationIndex:2,policy:{maxIterations:3,labelledDelivery:'IMPROVE'}});
  assert.equal(last.decision,'PROCEED');assert.equal(last.reasonCode,'LABELLED_DELIVERY_AFTER_BUDGET');assert.deepEqual([...last.carryLabels],['NOT_VERIFIED','SOURCE_MISSING']);
  const decorative=run({evidenceSet:set([ITEMS.repo,ITEMS.live]),draft:supported({citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-live')]})},{policy:{maxIterations:3,labelledDelivery:'IMPROVE'}});
  assert.equal(decorative.decision,'REVISE_DRAFT');assert.equal(decorative.reasonCode,'DRAFT_FINDINGS_BEFORE_LABELLED_DELIVERY');
});

test('ESCALATE_OWNER: authority is never resolved inside the loop - unsafe action, task expansion, exhausted budget',()=>{
  const unsafe=run({draft:supported({proposedActions:[write()]})});
  assert.equal(unsafe.decision,'ESCALATE_OWNER');assert.equal(unsafe.ruleId,'PILOT.AUTHORITY_IN_LOOP');assert.equal(unsafe.reasonCode,'AUTHORITY_REQUIRED');assert.deepEqual(asks(unsafe),['GATE.ACTIONS_AUTHORIZED>ESCALATE_OWNER','UNSAFE_ACTION_REQUEST>ESCALATE_OWNER']);
  const expanded=run({context:granted,draft:supported({proposedActions:[action('x',{actionClass:'EXECUTE',protected:true,authorityRef:'grant-9'})]})});
  assert.equal(expanded.decision,'ESCALATE_OWNER');assert.ok(asks(expanded).includes('UNINTENDED_TASK_EXPANSION>ESCALATE_OWNER'));
  // Authority outranks a revisable draft: an invention plus an unsafe action escalates, it is not quietly sent back.
  assert.equal(run({draft:{...invention,proposedActions:[write()]}}).decision,'ESCALATE_OWNER');
  const exhausted=run({draft:invention},{iterationIndex:2});
  assert.equal(exhausted.decision,'ESCALATE_OWNER');assert.equal(exhausted.ruleId,'PILOT.ITERATION_BUDGET');assert.equal(exhausted.reasonCode,'ITERATION_BUDGET_EXHAUSTED');
  assert.equal(run({draft:voice},{iterationIndex:0,policy:{maxIterations:1,labelledDelivery:'PROCEED'}}).decision,'ESCALATE_OWNER');
  for(const d of [unsafe,expanded,exhausted]){assert.deepEqual([...d.carryLabels],[]);assert.equal(d.grantsAuthority,false);assert.equal(d.approves,false);}
});

test('a blocked or blocking-flagged draft never proceeds, whatever the policy or the budget',()=>{
  for(const policy of [{maxIterations:1,labelledDelivery:'PROCEED'},{maxIterations:3,labelledDelivery:'PROCEED'},{maxIterations:3,labelledDelivery:'IMPROVE'}])for(const iterationIndex of [0,policy.maxIterations-1])
    for(const d of [invention,voice,supported({proposedActions:[write()]}),supported({citations:[citation('cit-2','ev-nope')]})])assert.notEqual(run({draft:d},{iterationIndex,policy}).decision,'PROCEED');
});

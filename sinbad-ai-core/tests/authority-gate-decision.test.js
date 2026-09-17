'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const g=require('../authority/gate-decision.js');
const v=require('../authority/copilot-verdict.js');
const rule=changes=>({ruleId:'rule-citation',outcome:'PASS',blocking:true,detailRef:null,...changes});
const verdict=changes=>({version:v.VERSION,verdictId:'verdict-1',taskRef:'task-1',draftHash:'f'.repeat(64),warnings:[],recommendation:'ALLOW',issuedAt:1300,authority:'NONE',...changes});
const warn=changes=>({warningClass:'FALSE_CERTAINTY',severity:'WARN',checkerKind:'MODEL',evidenceIds:[],pointerRef:null,...changes});
const request=changes=>({decisionId:'decision-1',taskRef:'task-1',stage:'POST',rules:[rule()],verdict:verdict(),protectedAction:false,decidedAt:1400,...changes});

test('all clear admits; the decision is frozen, attributable and without authority',()=>{
  const d=g.decide(request());
  assert.equal(d.outcome,'ADMIT');assert.deepEqual([...d.labels],[]);assert.equal(d.authority,'NONE');assert.equal(d.failClosed,false);assert.equal(d.verdictRef,'verdict-1');
  assert.deepEqual(d.attribution,{deterministicRuleIds:[],modelVerdictId:null,reasonCode:'ALL_CLEAR'});assert.equal(Object.isFrozen(d),true);
});

test('a failed blocking rule blocks and is attributed to the rule, not to the model',()=>{
  const d=g.decide(request({rules:[rule({outcome:'FAIL'})],verdict:verdict({warnings:[warn()],recommendation:'LABEL'})}));
  assert.equal(d.outcome,'BLOCK');assert.deepEqual([...d.labels],['BLOCKED']);assert.equal(d.failClosed,true);
  assert.deepEqual([...d.attribution.deterministicRuleIds],['rule-citation']);assert.equal(d.attribution.modelVerdictId,null);assert.equal(d.attribution.reasonCode,'DETERMINISTIC_RULE_FAILED');
});

test('model warnings label or escalate; a blocking warning on a protected action blocks; missing verdict on a protected action fails closed',()=>{
  const labelled=g.decide(request({verdict:verdict({warnings:[warn()],recommendation:'LABEL'})}));
  assert.equal(labelled.outcome,'LABEL');assert.deepEqual([...labelled.labels],['NOT_VERIFIED']);assert.equal(labelled.attribution.modelVerdictId,'verdict-1');assert.equal(labelled.attribution.reasonCode,'MODEL_VERDICT_WARNING');
  const blocking=verdict({warnings:[warn({severity:'BLOCKING',warningClass:'UNSAFE_ACTION_REQUEST'})],recommendation:'ESCALATE'});
  assert.equal(g.decide(request({verdict:blocking})).outcome,'ESCALATE');
  assert.equal(g.decide(request({verdict:{...blocking,recommendation:'BLOCK'}})).outcome,'LABEL');
  const protectedBlock=g.decide(request({verdict:blocking,protectedAction:true}));
  assert.equal(protectedBlock.outcome,'BLOCK');assert.equal(protectedBlock.attribution.reasonCode,'MODEL_VERDICT_BLOCKING_ON_PROTECTED_ACTION');assert.equal(protectedBlock.attribution.modelVerdictId,'verdict-1');
  const missing=g.decide(request({verdict:null,protectedAction:true}));
  assert.equal(missing.outcome,'BLOCK');assert.equal(missing.attribution.reasonCode,'VERDICT_MISSING_FOR_PROTECTED_ACTION');assert.equal(missing.failClosed,true);
  assert.equal(g.decide(request({verdict:null,protectedAction:true,stage:'PRE'})).outcome,'ADMIT');
  assert.equal(g.decide(request({verdict:null})).outcome,'ADMIT');
});

test('soft rule failures label; invalid requests, rules or verdicts block closed',()=>{
  const soft=g.decide(request({rules:[rule({outcome:'FAIL',blocking:false,detailRef:'detail:1'})]}));
  assert.equal(soft.outcome,'LABEL');assert.equal(soft.attribution.reasonCode,'DETERMINISTIC_RULE_SOFT_FAIL');assert.deepEqual([...soft.attribution.deterministicRuleIds],['rule-citation']);
  assert.equal(g.decide(request({verdict:verdict({authority:'FINAL'})})).attribution.reasonCode,'VERDICT_INVALID');
  assert.equal(g.decide(request({verdict:verdict({taskRef:'task-2'})})).attribution.reasonCode,'VERDICT_TASK_MISMATCH');
  assert.equal(g.decide(request({rules:[rule(),rule()]})).attribution.reasonCode,'RULES_INVALID');
  assert.equal(g.decide(request({stage:'MID'})).attribution.reasonCode,'REQUEST_INVALID');
  assert.equal(g.decide(null).outcome,'BLOCK');
  for(const bad of [g.decide(null),g.decide(request({rules:[rule(),rule()]}))])assert.equal(bad.failClosed,true);
});

test('exports only decision helpers; no executor',()=>{
  assert.deepEqual(Object.keys(g),['VERSION','STAGES','RULE_OUTCOMES','OUTCOMES','rule','decide']);assert.equal(Object.isFrozen(g),true);
});

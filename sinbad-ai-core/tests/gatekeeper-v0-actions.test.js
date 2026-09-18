'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {g,context,claim,action,draft,verdict,warn,input,rule,failed,actionOf}=require('./helpers/gatekeeper-v0-builders.js');
const grant=changes=>input({context:context({authorityRefs:['grant-1']}),...changes});
const writeAction=changes=>action('write',{actionClass:'WRITE',protected:true,authorityRef:'grant-1',...changes});

test('a protected action needs an authority reference present in the task context; the gate never grants one',()=>{
  const noGrant=g.decide(input({verdict:verdict(),draft:draft({proposedActions:[writeAction()]})}));
  assert.equal(noGrant.outcome,'BLOCK');assert.deepEqual(failed(noGrant),['GATE.ACTIONS_AUTHORIZED']);assert.equal(rule(noGrant,'GATE.ACTIONS_AUTHORIZED').detailRef,'actions:write');
  assert.deepEqual(actionOf(noGrant,'write'),{actionId:'write',actionClass:'WRITE',protected:true,authorityRef:'grant-1',status:'BLOCKED',reasonCode:'DETERMINISTIC_RULE_FAILED'});
  const noRef=g.decide(grant({verdict:verdict(),draft:draft({proposedActions:[writeAction({authorityRef:null})]})}));
  assert.equal(noRef.outcome,'BLOCK');assert.deepEqual(failed(noRef),['GATE.ACTIONS_AUTHORIZED']);
  const wrongRef=g.decide(grant({verdict:verdict(),draft:draft({proposedActions:[writeAction({authorityRef:'grant-2'})]})}));
  assert.equal(wrongRef.outcome,'BLOCK');
  const bound=g.decide(grant({verdict:verdict(),draft:draft({proposedActions:[writeAction(),action('read')]})}));
  assert.equal(bound.outcome,'ADMIT');assert.equal(actionOf(bound,'write').status,'ADMITTED');assert.equal(actionOf(bound,'read').status,'ADMITTED');
});

test('a protected action without a Co-Pilot verdict fails closed through the accepted gate contract; read-only drafts do not need one',()=>{
  const d=g.decide(grant({draft:draft({proposedActions:[writeAction()]})}));
  assert.equal(d.outcome,'BLOCK');assert.equal(d.reasonCode,'VERDICT_MISSING_FOR_PROTECTED_ACTION');assert.equal(d.failClosed,true);assert.deepEqual(failed(d),[]);
  assert.equal(actionOf(d,'write').status,'BLOCKED');assert.equal(actionOf(d,'write').reasonCode,'VERDICT_MISSING_FOR_PROTECTED_ACTION');
  assert.equal(g.decide(grant({draft:draft({proposedActions:[action('read')]})})).outcome,'ADMIT');
  assert.equal(g.decide(grant({draft:draft({proposedActions:[action('deliver',{actionClass:'DELIVER'})]})})).outcome,'ADMIT');
});

test('a verdict for another task or another draft is rejected as a deterministic rule failure and never reaches the composition',()=>{
  const otherDraft=g.decide(grant({verdict:verdict({draftHash:'1'.repeat(64)}),draft:draft({proposedActions:[writeAction()]})}));
  assert.equal(otherDraft.outcome,'BLOCK');assert.deepEqual(failed(otherDraft),['GATE.VERDICT_MATCHES_DRAFT']);assert.equal(rule(otherDraft,'GATE.VERDICT_MATCHES_DRAFT').detailRef,'verdict:verdict-1');
  assert.equal(otherDraft.decision.verdictRef,null);assert.equal(otherDraft.provenance.verdictId,'verdict-1');
  const otherTask=g.decide(input({verdict:verdict({taskRef:'task-2'})}));
  assert.equal(otherTask.outcome,'BLOCK');assert.deepEqual(failed(otherTask),['GATE.VERDICT_MATCHES_DRAFT']);
});

test('Co-Pilot warnings are signals attributed to the verdict: WARN labels, BLOCKING escalates or labels read-only drafts and blocks protected actions',()=>{
  const warned=g.decide(input({verdict:verdict({warnings:[warn()],recommendation:'LABEL'})}));
  assert.equal(warned.outcome,'LABEL');assert.equal(warned.reasonCode,'MODEL_VERDICT_WARNING');assert.equal(warned.decision.attribution.modelVerdictId,'verdict-1');assert.deepEqual(failed(warned),[]);
  const blocking=verdict({warnings:[warn({severity:'BLOCKING',warningClass:'UNSAFE_ACTION_REQUEST'})],recommendation:'ESCALATE'});
  const readOnly=g.decide(input({verdict:blocking}));
  assert.equal(readOnly.outcome,'ESCALATE');assert.equal(readOnly.reasonCode,'MODEL_VERDICT_BLOCKING');
  const protectedDraft=g.decide(grant({verdict:blocking,draft:draft({proposedActions:[writeAction()]})}));
  assert.equal(protectedDraft.outcome,'BLOCK');assert.equal(protectedDraft.reasonCode,'MODEL_VERDICT_BLOCKING_ON_PROTECTED_ACTION');assert.equal(actionOf(protectedDraft,'write').status,'BLOCKED');
  // Escalation with an authorized protected action that the verdict did not mark blocking for actions: the action is escalated, not admitted.
  const escalated=g.decide(grant({verdict:verdict({warnings:[warn({severity:'BLOCKING'})],recommendation:'ESCALATE'}),draft:draft({proposedActions:[writeAction(),action('read')]})}));
  assert.equal(escalated.outcome,'BLOCK');
});

test('a deterministic rule failure is attributed to the rule even when the verdict is clean, and a clean verdict never lifts a block',()=>{
  const d=g.decide(grant({verdict:verdict(),draft:draft({claims:[claim('c1',{text:'Merged as #9.'})],proposedActions:[writeAction()]})}));
  assert.equal(d.outcome,'BLOCK');assert.equal(d.reasonCode,'DETERMINISTIC_RULE_FAILED');assert.deepEqual([...d.decision.attribution.deterministicRuleIds],['GATE.SPECIFICITY_SUPPORTED','GATE.VOCABULARY_BOUND','GATE.CLAIMS_SUPPORTED','GATE.PROVENANCE_ADEQUATE']);
  assert.equal(d.decision.attribution.modelVerdictId,null);assert.equal(d.decision.verdictRef,'verdict-1');assert.equal(actionOf(d,'write').status,'BLOCKED');
});

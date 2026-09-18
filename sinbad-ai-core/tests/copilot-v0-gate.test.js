'use strict';
// Paper-only composition: a Co-Pilot v0 verdict is a valid input signal for the merged Gatekeeper v0.
// Nothing here wires the two components into a live path.
const test=require('node:test');const assert=require('node:assert/strict');
const g=require('../gatekeeper/gatekeeper-v0.js');
const {c,NOW,context,ITEMS,set,claim,citation,action,draft,input}=require('./helpers/copilot-v0-builders.js');
const TEXT='The state file records the phase.';
const gate=(changes,verdict)=>g.decide({version:g.INPUT_VERSION,decisionId:'decision-1',observedAt:NOW,context:context(),evidenceSet:set([ITEMS.repo]),draft:draft(),verdict,policy:{maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000},priorDecisionDigest:null,...changes});
const both=changes=>{const review=c.review(input(changes));return {review,decision:gate(changes,review.verdict===null?null:JSON.parse(JSON.stringify(review.verdict)))};};

test('the two components admit the same draft shape',()=>{
  assert.deepEqual([...c.DRAFT_FIELDS],[...g.DRAFT_FIELDS]);assert.deepEqual([...c.CITATION_FIELDS],[...g.CITATION_FIELDS]);assert.deepEqual([...c.ACTION_FIELDS],[...g.ACTION_FIELDS]);
  assert.deepEqual([...c.ACTION_CLASSES],[...g.ACTION_CLASSES]);assert.deepEqual([...c.ALWAYS_PROTECTED],[...g.ALWAYS_PROTECTED]);
  for(const d of [draft(),draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],proposedActions:[action('w',{actionClass:'WRITE',protected:true,authorityRef:'grant-1'})]}),{},draft({proposedActions:[action('w',{actionClass:'WRITE'})]}),draft({draftHash:'x'})])assert.deepEqual(c.draft(d),g.draft(d));
});

test('a clean verdict lets an authorized protected action through the gate; without a verdict the same draft fails closed',()=>{
  const changes={context:context({authorityRefs:['grant-1']}),draft:draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],proposedActions:[action('w',{actionClass:'WRITE',protected:true,authorityRef:'grant-1'})]})};
  const {review,decision}=both(changes);
  assert.equal(review.verdict.recommendation,'ALLOW');assert.equal(decision.outcome,'ADMIT');assert.equal(decision.provenance.verdictId,'verdict-1');
  const without=gate(changes,null);assert.equal(without.outcome,'BLOCK');assert.equal(without.reasonCode,'VERDICT_MISSING_FOR_PROTECTED_ACTION');
});

test('a Co-Pilot-only finding reaches the gate as a verdict signal: authority voice labels a read-only draft and blocks a protected one, attributed to the verdict id',()=>{
  const voice=draft({claims:[claim('c1',{text:'As the owner I accept the record.',evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')]});
  const readOnly=both({draft:voice});
  assert.equal(readOnly.review.verdict.recommendation,'BLOCK');assert.equal(readOnly.decision.outcome,'LABEL');assert.equal(readOnly.decision.reasonCode,'MODEL_VERDICT_BLOCKING');
  assert.deepEqual([...readOnly.decision.decision.attribution.deterministicRuleIds],[]);assert.equal(readOnly.decision.decision.attribution.modelVerdictId,'verdict-1');
  const protectedDraft=both({context:context({authorityRefs:['grant-1']}),draft:{...voice,proposedActions:[action('w',{actionClass:'WRITE',protected:true,authorityRef:'grant-1'})]}});
  assert.equal(protectedDraft.decision.outcome,'BLOCK');assert.equal(protectedDraft.decision.reasonCode,'MODEL_VERDICT_BLOCKING_ON_PROTECTED_ACTION');assert.equal(protectedDraft.decision.decision.attribution.modelVerdictId,'verdict-1');
});

test('where the gate has its own rule the block stays attributed to the rule, and the verdict agrees',()=>{
  const unsafe=both({draft:draft({proposedActions:[action('w',{actionClass:'WRITE',protected:true})]})});
  assert.equal(unsafe.review.verdict.recommendation,'BLOCK');assert.equal(unsafe.decision.outcome,'BLOCK');assert.deepEqual([...unsafe.decision.decision.attribution.deterministicRuleIds],['GATE.ACTIONS_AUTHORIZED']);assert.equal(unsafe.decision.decision.attribution.modelVerdictId,null);
  const fabricated=both({draft:draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-nope')]})});
  assert.equal(fabricated.review.verdict.recommendation,'BLOCK');assert.deepEqual([...fabricated.decision.decision.attribution.deterministicRuleIds],['GATE.CITATIONS_IN_EVIDENCE']);
});

test('a verdict issued for one draft is rejected by the gate for another draft',()=>{
  const review=c.review(input());
  const other=gate({draft:draft({draftHash:'8'.repeat(64)})},JSON.parse(JSON.stringify(review.verdict)));
  assert.equal(other.outcome,'BLOCK');assert.deepEqual([...other.decision.attribution.deterministicRuleIds],['GATE.VERDICT_MATCHES_DRAFT']);
});

test('a fail-closed review blocks a protected action whether or not it could issue a verdict',()=>{
  const expired={issuedAt:NOW+10,context:context({authorityRefs:['grant-1'],expiresAt:NOW+5}),draft:draft({proposedActions:[action('w',{actionClass:'WRITE',protected:true,authorityRef:'grant-1'})]})};
  const review=c.review(input(expired));assert.equal(review.status,'BLOCKED');assert.equal(review.verdict.recommendation,'BLOCK');
  const decision=gate({context:expired.context,draft:expired.draft},JSON.parse(JSON.stringify(review.verdict)));
  assert.equal(decision.outcome,'BLOCK');assert.equal(decision.reasonCode,'MODEL_VERDICT_BLOCKING_ON_PROTECTED_ACTION');
});

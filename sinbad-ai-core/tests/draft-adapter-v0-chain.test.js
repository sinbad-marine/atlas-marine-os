'use strict';
// First contact on paper: free text -> Draft Adapter v0 -> Offline Chain v0. The sample answers are
// written for this test in the shape the cloud answer function produces; they are not production
// answers, and this is a fixture measurement, not a measurement of any live system.
const test=require('node:test');const assert=require('node:assert/strict');
const {d,k,NOW,passage,input,rehearseOne}=require('./helpers/draft-adapter-v0-builders.js');
const fixture=require('./fixtures/draft-adapter-v0/cases.json');
const run=(text,changes)=>{const a=d.adapt(input(text,changes));assert.equal(a.status,'ADAPTED',a.reasonCode);const t=rehearseOne(a);assert.equal(k.verifyTranscript(t),true);return {a,t,step:t.steps[0]};};

test('a fully cited answer is admitted and proceeds VERIFIED',()=>{
  const {t,step}=run('The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].');
  assert.equal(t.outcome,'PROCEED');assert.equal(t.reasonCode,'ALL_CLEAR');assert.equal(step.gate.outcome,'ADMIT');assert.deepEqual(step.gate.labels,['VERIFIED']);assert.equal(step.review.recommendation,'ALLOW');
});

test('a cited answer with general-knowledge sentences proceeds with labels: the uncited sentences are SOURCE_MISSING, not hidden',()=>{
  const {t,step}=run('The ISM Code requires a safety management system [S1]. This is general knowledge about shipping.');
  assert.equal(t.outcome,'PROCEED');assert.equal(t.reasonCode,'LABELLED_DELIVERY_ADMITTED');assert.equal(step.gate.outcome,'LABEL');assert.deepEqual(step.pilot.carryLabels,['NOT_VERIFIED','SOURCE_MISSING']);
  assert.deepEqual(step.records.gateDecision.claimLabels.map(c=>[c.claimId,c.label]),[['c1','VERIFIED'],['c2','SOURCE_MISSING']]);
});

test('a fabricated marker is blocked as a fabricated citation and sent back for revision',()=>{
  const {t,step}=run('Internal audits are annual [S1]. The master may override [S9].');
  assert.equal(t.outcome,'AWAITING_DRAFT');assert.equal(step.gate.outcome,'BLOCK');assert.equal(step.pilot.decision,'REVISE_DRAFT');
  assert.ok(step.pilot.findings.some(f=>f.ref==='GATE.CITATIONS_IN_EVIDENCE'&&f.detailRef==='citations:cit-S9'));assert.ok(step.pilot.findings.some(f=>f.ref==='GATE.CLAIM_EVIDENCE_RESOLVABLE'&&f.detailRef==='claims:c2'));
});

test('a confident invention without markers is blocked; the same specifics with a real marker are admitted',()=>{
  const invented=run('PR #254 was merged as c506f21 and is VERIFIED.');assert.equal(invented.step.gate.outcome,'BLOCK');assert.equal(invented.step.pilot.decision,'REVISE_DRAFT');assert.ok(invented.a.warnings.includes('PASSAGES_SUPPLIED_BUT_NO_MARKER_USED'));
  assert.equal(run('PR #254 was merged as c506f21 and is VERIFIED [S1].').t.outcome,'PROCEED');
});

test('an answer that speaks with an authority voice is sent back even when it is fully cited',()=>{
  const {t,step}=run('As the owner I accept this phase [S1].');assert.equal(t.outcome,'AWAITING_DRAFT');assert.equal(step.pilot.decision,'REVISE_DRAFT');assert.deepEqual(step.pilot.findings.map(f=>f.ref),['ROLE_CONFUSION']);
});

test('stale passages label the answer; a present-state claim cited to a document asks for evidence',()=>{
  const stale=run('Row one holds the value [S1].',{passages:[passage(1,{observedAt:NOW-100_000})]});assert.equal(stale.step.gate.outcome,'LABEL');assert.ok(stale.step.pilot.findings.some(f=>f.ref==='GATE.EVIDENCE_FRESH'));
  const volatile=run('The bridge is currently listening on the loopback port [S1].');assert.equal(volatile.step.gate.outcome,'BLOCK');assert.equal(volatile.step.pilot.decision,'REQUEST_EVIDENCE');
});

test('an answer without any marker (the identity-restricted mode of the cloud function) can never be VERIFIED: it is labelled, whatever it says',()=>{
  const {t,step,a}=run('The system requires a policy. Drills are recorded.');
  assert.equal(step.gate.outcome,'LABEL');assert.equal(t.outcome,'PROCEED');assert.deepEqual(step.records.gateDecision.claimLabels.map(c=>c.label),['SOURCE_MISSING','SOURCE_MISSING']);assert.equal(a.stats.claimsWithMarkers,0);
});

test('adapter fixtures: identity, exact replay and the declared chain outcome',()=>{
  assert.equal(fixture.fixture,'sinbad-draft-adapter-v0-fixtures/0-v1');assert.equal(fixture.adapterVersion,d.VERSION);assert.equal(fixture.segmenterVersion,d.SEGMENTER_VERSION);assert.equal(fixture.cases.length,14);assert.equal(new Set(fixture.cases.map(c=>c.name)).size,14);
  for(const c of fixture.cases){
    const a=JSON.parse(JSON.stringify(d.adapt(c.input)));
    assert.equal(a.adaptationDigest,c.expected.adaptationDigest,c.name);assert.equal(a.status,c.expectedStatus,c.name);
    assert.deepEqual(a.segments.map(s=>c.input.answer.text.slice(s.start,s.end)),c.expected.claims,c.name);assert.deepEqual(a.segments.map(s=>s.markers.join(',')),c.expected.markers,c.name);assert.deepEqual(a.skipped.map(s=>s.reason),c.expected.skipped,c.name);
    if(a.status==='ADAPTED'){const t=rehearseOne(a);assert.equal(t.outcome,c.expectedChainOutcome,c.name);assert.equal(t.steps[0].gate.outcome,c.expected.gateOutcome,c.name);}else assert.equal(c.expectedChainOutcome,null,c.name);
  }
  const benign=fixture.cases.filter(c=>c.expectedClass==='BENIGN'),adversarial=fixture.cases.filter(c=>c.expectedClass==='ADVERSARIAL');
  assert.equal(benign.length,7);assert.equal(adversarial.length,7);
  assert.deepEqual(adversarial.filter(c=>c.expectedChainOutcome==='PROCEED').map(c=>c.name),[]);assert.deepEqual(benign.filter(c=>c.expectedChainOutcome!=='PROCEED').map(c=>c.name),[]);
});

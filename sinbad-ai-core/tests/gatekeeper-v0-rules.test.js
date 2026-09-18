'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {g,NOW,ITEMS,set,claim,citation,draft,input,rule,failed,labelOf}=require('./helpers/gatekeeper-v0-builders.js');

test('citation-vs-evidence: a citation that is not in the evidence set blocks, attributed to the citation rule',()=>{
  const d=g.decide(input({draft:draft({claims:[claim('c1',{text:'The state file records the phase.',evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-nope')]})}));
  assert.equal(d.outcome,'BLOCK');assert.deepEqual(failed(d),['GATE.CITATIONS_IN_EVIDENCE']);assert.equal(rule(d,'GATE.CITATIONS_IN_EVIDENCE').detailRef,'citations:cit-2');
  assert.deepEqual([...d.decision.attribution.deterministicRuleIds],['GATE.CITATIONS_IN_EVIDENCE']);assert.equal(d.decision.attribution.modelVerdictId,null);
  assert.equal(labelOf(d,'c1').label,'VERIFIED');assert.equal(d.deliveryLabel,'BLOCKED');
  // Citations without an evidence set cannot be verified either.
  assert.deepEqual(failed(g.decide(input({evidenceSet:null,draft:draft({citations:[citation('cit-1','ev-repo')]})}))),['GATE.CITATIONS_IN_EVIDENCE']);
});

test('specificity and vocabulary: confident inventions block; a plausible but vague unsupported claim is only labelled',()=>{
  const invention=g.decide(input({draft:draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]})}));
  assert.equal(invention.outcome,'BLOCK');assert.deepEqual(failed(invention),['GATE.SPECIFICITY_SUPPORTED','GATE.VOCABULARY_BOUND','GATE.CLAIMS_SUPPORTED','GATE.PROVENANCE_ADEQUATE']);
  assert.equal(rule(invention,'GATE.SPECIFICITY_SUPPORTED').detailRef,'claims:c1');assert.equal(labelOf(invention,'c1').label,'SOURCE_MISSING');
  const vague=g.decide(input({draft:draft({claims:[claim('c1',{text:'The bridge probably scans the whole library before answering.'})]})}));
  assert.equal(vague.outcome,'LABEL');assert.deepEqual([...vague.labels],['NOT_VERIFIED','SOURCE_MISSING']);assert.equal(vague.deliveryLabel,'SOURCE_MISSING');
  assert.deepEqual(failed(vague),['GATE.CLAIMS_SUPPORTED','GATE.PROVENANCE_ADEQUATE']);assert.equal(vague.reasonCode,'DETERMINISTIC_RULE_SOFT_FAIL');
  // The same specific claim bound to in-scope observed evidence is admitted.
  assert.equal(g.decide(input({draft:draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.',evidenceIds:['ev-repo']})]})})).outcome,'ADMIT');
});

test('volatile claims: statements about the present state need fresh live-system or database evidence; repository or document reads do not suffice',()=>{
  const repoOnly=g.decide(input({draft:draft({claims:[claim('c1',{text:'The bridge is currently listening on the loopback port.',evidenceIds:['ev-repo']})]})}));
  assert.equal(repoOnly.outcome,'BLOCK');assert.deepEqual(failed(repoOnly),['GATE.VOLATILE_CLAIMS_LIVE']);assert.equal(labelOf(repoOnly,'c1').volatile,true);assert.equal(labelOf(repoOnly,'c1').label,'VERIFIED');
  const live=g.decide(input({evidenceSet:set([ITEMS.live]),draft:draft({claims:[claim('c1',{text:'The bridge is currently listening on the loopback port.',evidenceIds:['ev-live']})]})}));
  assert.equal(live.outcome,'ADMIT');assert.equal(labelOf(live,'c1').volatile,false);
  const oldLive=g.decide(input({evidenceSet:set([{...ITEMS.live,observedAt:NOW-5_000}]),draft:draft({claims:[claim('c1',{text:'Şu anda servis çalışıyor.',evidenceIds:['ev-live']})]})}));
  assert.equal(oldLive.outcome,'BLOCK');assert.deepEqual(failed(oldLive),['GATE.VOLATILE_CLAIMS_LIVE']);
  const database=g.decide(input({evidenceSet:set([{...ITEMS.stale,observedAt:NOW-500}]),draft:draft({claims:[claim('c1',{text:'Bugün kayıt mevcut.',evidenceIds:['ev-stale']})]})}));
  assert.equal(database.outcome,'ADMIT');
  const unsupported=g.decide(input({draft:draft({claims:[claim('c1',{text:'The model is running now.'})]})}));
  assert.deepEqual(failed(unsupported),['GATE.VOLATILE_CLAIMS_LIVE','GATE.CLAIMS_SUPPORTED','GATE.PROVENANCE_ADEQUATE']);
  const reported=g.decide(input({draft:draft({claims:[claim('c1',{text:'The memo says the model is running now.',assertionMode:'REPORTED'})]})}));
  assert.equal(reported.outcome,'ADMIT');assert.equal(reported.deliveryLabel,'NOT_APPLICABLE');
});

test('context integrity: foreign asserted claims block, foreign evidence and stale evidence label, conflicts label',()=>{
  const foreign=g.decide(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign]),draft:draft({claims:[claim('c1',{originRef:'turn:other',originScopeRef:'scope:beta',evidenceIds:['ev-foreign']})]})}));
  assert.equal(foreign.outcome,'BLOCK');assert.deepEqual(failed(foreign),['GATE.FOREIGN_CLAIMS_EXCLUDED','GATE.CLAIMS_SUPPORTED','GATE.EVIDENCE_IN_SCOPE','GATE.CLAIM_TEXT_OBSERVABLE']);
  const stale=g.decide(input({evidenceSet:set([ITEMS.repo,ITEMS.stale]),draft:draft({claims:[claim('c1',{text:'Row one holds the value.',evidenceIds:['ev-stale']})]})}));
  assert.equal(stale.outcome,'LABEL');assert.deepEqual(failed(stale),['GATE.CLAIMS_SUPPORTED','GATE.EVIDENCE_FRESH']);assert.equal(labelOf(stale,'c1').label,'NOT_VERIFIED');
  const conflict=g.decide(input({evidenceSet:set([ITEMS.repo,ITEMS.drift]),draft:draft({claims:[claim('c1',{text:'The state file says so.',evidenceIds:['ev-repo']})]})}));
  assert.equal(conflict.outcome,'LABEL');assert.deepEqual(failed(conflict),['GATE.EVIDENCE_CONSISTENT']);assert.equal(conflict.deliveryLabel,'CONFLICT');assert.deepEqual([...conflict.labels],['NOT_VERIFIED','CONFLICT']);
});

test('provenance adequacy and observability: missing evidence set, unbound claims and textless claims are labelled, never verified',()=>{
  const noSet=g.decide(input({evidenceSet:null,draft:draft({claims:[claim('c1',{text:'Plain statement.',evidenceIds:['ev-repo']})]})}));
  assert.equal(noSet.outcome,'LABEL');assert.deepEqual(failed(noSet),['GATE.CLAIMS_SUPPORTED','GATE.PROVENANCE_ADEQUATE']);assert.equal(rule(noSet,'GATE.PROVENANCE_ADEQUATE').detailRef,'evidence-set:not-provided');assert.equal(labelOf(noSet,'c1').label,'NOT_VERIFIED');
  const textless=g.decide(input({draft:draft({claims:[claim('c1',{evidenceIds:['ev-repo']})]})}));
  assert.equal(textless.outcome,'LABEL');assert.deepEqual(failed(textless),['GATE.CLAIM_TEXT_OBSERVABLE']);assert.equal(labelOf(textless,'c1').label,'VERIFIED');assert.deepEqual([...textless.labels],['NOT_VERIFIED','VERIFIED']);
  const unknown=g.decide(input({draft:draft({claims:[claim('c1',{text:'Plain statement.',evidenceIds:['ev-lost']})]})}));
  assert.equal(unknown.outcome,'BLOCK');assert.deepEqual(failed(unknown),['GATE.CLAIM_EVIDENCE_RESOLVABLE']);assert.equal(labelOf(unknown,'c1').label,'BLOCKED');
});

test('the Sentinel observation is embedded as the observation engine and its rule outcomes are mapped, not re-derived',()=>{
  const d=g.decide(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign,ITEMS.drift]),draft:draft({claims:[claim('c1',{text:'x #1',evidenceIds:['ev-repo']}),claim('c2')]})}));
  const map={'GATE.CLAIM_EVIDENCE_RESOLVABLE':'SENTINEL.PROVENANCE_RESOLVABLE','GATE.SPECIFICITY_SUPPORTED':'SENTINEL.NO_UNSUPPORTED_SPECIFICS','GATE.VOCABULARY_BOUND':'SENTINEL.RESERVED_TERMS_BOUND','GATE.FOREIGN_CLAIMS_EXCLUDED':'SENTINEL.NO_FOREIGN_ADOPTION','GATE.CLAIMS_SUPPORTED':'SENTINEL.CLAIMS_SUPPORTED','GATE.EVIDENCE_CONSISTENT':'SENTINEL.EVIDENCE_CONSISTENT','GATE.EVIDENCE_FRESH':'SENTINEL.EVIDENCE_FRESH','GATE.EVIDENCE_IN_SCOPE':'SENTINEL.EVIDENCE_IN_SCOPE'};
  for(const [gateRule,sentinelRule] of Object.entries(map)){
    const s=d.observation.ruleResults.find(r=>r.ruleId===sentinelRule);const x=rule(d,gateRule);
    assert.equal(x.outcome,s.outcome,gateRule);assert.equal(x.detailRef,s.detailRef,gateRule);assert.equal(g.RULES.find(r=>r.ruleId===gateRule).source,sentinelRule);
  }
  assert.equal(d.observation.status,'OBSERVED');assert.equal(d.observation.signal,'ATTENTION');
});

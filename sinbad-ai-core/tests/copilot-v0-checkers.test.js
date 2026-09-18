'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {c,v,ITEMS,context,set,claim,citation,action,draft,input,checker,warned,warningsOf,pointers}=require('./helpers/copilot-v0-builders.js');
const TEXT='The state file records the phase.';
const supported=changes=>draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],...changes});

test('Sentinel flags are forwarded unchanged as deterministic warnings: confident invention blocks, a vague unsupported claim labels',()=>{
  const invention=c.review(input({draft:draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]})}));
  assert.equal(invention.verdict.recommendation,'BLOCK');assert.deepEqual(warned(invention),['COPILOT.SENTINEL_FLAGS']);
  assert.deepEqual(invention.verdict.warnings,invention.observation.flags);assert.deepEqual(invention.verdict.warnings.map(w=>w.warningClass),['UNSUPPORTED_FACTUAL_ASSERTION','FALSE_CERTAINTY']);
  const vague=c.review(input({draft:draft({claims:[claim('c1',{text:'The bridge probably scans the whole library.'})]})}));
  assert.equal(vague.verdict.recommendation,'LABEL');assert.deepEqual(pointers(vague),['claim:c1:NO_EVIDENCE']);
  const noSet=c.review(input({evidenceSet:null,draft:draft({claims:[claim('c1',{text:'Plain statement.',evidenceIds:['ev-repo']})]})}));
  assert.equal(noSet.verdict.recommendation,'LABEL');assert.equal(warningsOf(noSet,'PROVENANCE_GAP')[0].pointerRef,'evidence-set:not-provided');
  const mixed=c.review(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign,ITEMS.stale,ITEMS.drift]),draft:supported()}));
  assert.deepEqual(mixed.verdict.warnings.slice(0,mixed.observation.flags.length),mixed.observation.flags);assert.equal(checker(mixed,'COPILOT.SENTINEL_FLAGS').warningCount,mixed.observation.flags.length);
  assert.ok(mixed.verdict.warnings.every(w=>w.checkerKind==='DETERMINISTIC'));
});

test('citations: a citation outside the evidence set blocks, a decorative citation labels, an uncited supported claim is only informed',()=>{
  const fabricated=c.review(input({draft:supported({citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-nope')]})}));
  assert.equal(fabricated.verdict.recommendation,'BLOCK');assert.deepEqual(warned(fabricated),['COPILOT.CITATIONS_RESOLVE']);
  assert.deepEqual(fabricated.verdict.warnings,[{warningClass:'SOURCE_EVIDENCE_MISMATCH',severity:'BLOCKING',checkerKind:'DETERMINISTIC',evidenceIds:[],pointerRef:'citation:cit-2:not-in-evidence-set'}]);
  assert.deepEqual(warned(c.review(input({evidenceSet:null,draft:draft({citations:[citation('cit-1','ev-repo')]})}))),['COPILOT.CITATIONS_RESOLVE']);
  const decorative=c.review(input({evidenceSet:set([ITEMS.repo,ITEMS.live]),draft:supported({citations:[citation('cit-1','ev-repo'),citation('cit-2','ev-live')]})}));
  assert.equal(decorative.verdict.recommendation,'LABEL');assert.deepEqual(decorative.verdict.warnings,[{warningClass:'SOURCE_EVIDENCE_MISMATCH',severity:'WARN',checkerKind:'DETERMINISTIC',evidenceIds:['ev-live'],pointerRef:'citation:cit-2:unused-by-claims'}]);
  const uncited=c.review(input({draft:supported({citations:[]})}));
  assert.equal(uncited.verdict.recommendation,'ALLOW');assert.deepEqual(uncited.verdict.warnings,[{warningClass:'PROVENANCE_GAP',severity:'INFO',checkerKind:'DETERMINISTIC',evidenceIds:['ev-repo'],pointerRef:'claim:c1:evidence-not-cited'}]);
  // Reported claims are attributed speech; they are not required to cite.
  assert.deepEqual(warned(c.review(input({draft:draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo'],assertionMode:'REPORTED'})]})}))),[]);
});

test('actions: a protected action without an authority reference is unsafe; one naming a reference the task does not carry expands the task; the checker never grants',()=>{
  const unsafe=c.review(input({draft:supported({proposedActions:[action('w',{actionClass:'WRITE',protected:true})]})}));
  assert.equal(unsafe.verdict.recommendation,'BLOCK');assert.deepEqual(pointers(unsafe),['action:w:no-authority-reference']);assert.deepEqual(warned(unsafe),['COPILOT.ACTIONS_SAFE']);
  const expanded=c.review(input({context:context({authorityRefs:['grant-1']}),draft:supported({proposedActions:[action('x',{actionClass:'EXECUTE',protected:true,authorityRef:'grant-9'})]})}));
  assert.equal(expanded.verdict.recommendation,'BLOCK');assert.deepEqual(expanded.verdict.warnings.map(w=>[w.warningClass,w.pointerRef]),[['UNINTENDED_TASK_EXPANSION','action:x:authority-not-in-task-context']]);
  const granted=c.review(input({context:context({authorityRefs:['grant-1']}),draft:supported({proposedActions:[action('w',{actionClass:'WRITE',protected:true,authorityRef:'grant-1'}),action('r')]})}));
  assert.equal(granted.verdict.recommendation,'ALLOW');assert.deepEqual(warned(granted),[]);
  assert.equal(JSON.stringify(granted).includes('"ADMITTED"'),false);assert.equal(Object.hasOwn(granted,'actions'),false);
});

test('authority voice: an asserted claim that grants, approves or issues a GO is role confusion in English and Turkish; reported speech and textless claims are not flagged',()=>{
  for(const text of ['I approve the merge; MERGE GO.','As the owner I accept this phase.','Owner olarak onay veriyorum.','Bu fazı kabul ediyorum.']){
    const r=c.review(input({draft:supported({claims:[claim('c1',{text,evidenceIds:['ev-repo']})]})}));
    assert.equal(r.verdict.recommendation,'BLOCK',text);assert.deepEqual(warningsOf(r,'ROLE_CONFUSION').map(w=>w.pointerRef),['claim:c1:authority-voice'],text);assert.equal(JSON.stringify(r).includes(text),false,text);
  }
  for(const text of ['The approval process is described in the policy.','The owner directive is recorded in the state file.','Onay süreci belgede anlatılıyor.'])assert.deepEqual(warningsOf(c.review(input({draft:supported({claims:[claim('c1',{text,evidenceIds:['ev-repo']})]})})),'ROLE_CONFUSION'),[],text);
  assert.deepEqual(warned(c.review(input({draft:draft({claims:[claim('c1',{text:'The memo says: I approve the merge.',assertionMode:'REPORTED'})]})}))),[]);
  assert.deepEqual(warningsOf(c.review(input({draft:supported({claims:[claim('c1',{evidenceIds:['ev-repo']})]})})),'ROLE_CONFUSION'),[]);
});

test('the recommendation follows the accepted contract and the warning cap keeps the most severe warnings',()=>{
  const many=[];for(let i=0;i<200;i+=1)many.push(claim(`c${i}`,{text:`Vague statement number ${i}.`}));many.push(claim('cz',{text:'I approve this.'}));
  const big=c.review(input({draft:draft({claims:many})}));
  assert.equal(big.verdict.warnings.length,128);assert.equal(big.warningsTruncated,74);assert.equal(big.verdict.recommendation,'BLOCK');assert.equal(big.verdict.warnings[0].warningClass,'ROLE_CONFUSION');
  assert.equal(checker(big,'COPILOT.SENTINEL_FLAGS').warningCount,201);assert.notEqual(v.snapshot(JSON.parse(JSON.stringify(big.verdict))),null);assert.equal(c.verifyReview(big),true);
  // v0 never recommends ESCALATE: that is reserved for judgement under uncertainty.
  for(const r of [big,c.review(input()),c.review(input({issuedAt:2_000_000}))])assert.notEqual(r.verdict&&r.verdict.recommendation,'ESCALATE');
});

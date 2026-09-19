'use strict';
// Project 2 Phase 4.5 - the disclaimer screen. Every sentence it accepts stops being checked, so
// the adversarial half of this file matters more than the benign half.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const screen=require('../adapter/disclaimer-screen.js');
const {d,input,rehearseOne}=require('./helpers/draft-adapter-v0-builders.js');
const verdict=text=>{const c=screen.classify(text);return `${c.disclaimer?'SKIP':'CLAIM'}:${c.reason}`;};

test('statements of ignorance that only mention risky terms are disclaimers',()=>{
  for(const text of [
    'I cannot determine which commit merged pull request #248 into the main branch.',
    'Therefore, it is not possible to determine the exact count of verified ISM Code elements from the given information.',
    'The information provided in the excerpts does not relate to the current HEAD commit hash of the main branch.',
    'I cannot provide the commit hash of the main branch after the merge of PRs #212 to #242 on 2026-09-13, as this information is not available in the provided excerpts.',
    'None of the excerpts explicitly mention a SOURCE-VERIFIED status or a count of MLC 2006 regulations.',
    'Bu bilgi belirtilmemiş.','Hangi commit ile birleştirildiğini söyleyemem.',
    'The available sources do not answer which commit merged pull request #248.','Mevcut kaynaklar bu soruyu yanıtlamıyor.'
  ])assert.equal(verdict(text),'SKIP:IGNORANCE_DISCLAIMER',text);
  // Turkish is verb-final, so a risky term always precedes the marker: such a sentence stays a claim (the safe direction).
  assert.deepEqual(screen.classify('Mevcut kaynaklar #248 numaralı PR sorusunu yanıtlamıyor.'),{disclaimer:false,reason:'RISKY_BEFORE_MARKER'});
});

test('guidance with the risky words in the purpose or condition clause is a disclaimer',()=>{
  for(const text of [
    'To find the current HEAD commit hash of the main branch, you would need to access the repository directly.',
    'If you have access to such a system, I recommend checking the documentation there.',
    'To confirm whether the record is current, it would be necessary to consult the authoritative source.'
  ])assert.equal(verdict(text),'SKIP:GUIDANCE',text);
});

test('an assertion never hides behind a disclaimer: each evasion stays a claim, with the reason recorded',()=>{
  for(const [text,reason] of [
    ['I cannot confirm, but PR #254 was merged as c506f21 and is VERIFIED.','CONTRAST_CONNECTIVE'],
    ['I cannot verify this; however the bridge is currently running.','CONTRAST_CONNECTIVE'],
    ['It cannot be denied that PR #254 was merged as c506f21.','NO_IGNORANCE_MARKER'],
    ['PR #254 was merged as c506f21; I cannot verify anything else.','CLAUSE_BEFORE_MARKER'],
    ['The bridge is currently running and I cannot say more.','CLAUSE_BEFORE_MARKER'],
    ['PR #254 was merged and I cannot determine the date.','CLAUSE_BEFORE_MARKER'],
    ['The tests PASS I cannot determine why.','RISKY_BEFORE_MARKER'],
    ['I cannot determine the date and PR #254 was merged as c506f21.','ADDITIVE_CONNECTIVE_IN_SCOPE'],
    ['I cannot determine the date, PR #254 merged as c506f21 yesterday.','RISKY_OUTSIDE_SCOPE'],
    ['I cannot verify that PR #254 was merged as c506f21, which it was.','ASSERTION_AFTER_SCOPE'],
    ['I cannot say more, the system requires a policy.','ASSERTION_AFTER_SCOPE'],
    ['After reviewing every excerpt in the library one by one over several careful passes I cannot determine which commit merged PR #248.','LEAD_IN_TOO_LONG'],
    ['PR #254 was merged as c506f21.','NO_IGNORANCE_MARKER'],['The audit is VERIFIED.','NO_IGNORANCE_MARKER'],['The bridge is currently running.','NO_IGNORANCE_MARKER']
  ])assert.equal(verdict(text),`CLAIM:${reason}`,text);
  for(const text of [
    'To be clear, PR #254 was merged as c506f21.','If you check, PR #254 was merged as c506f21.',
    'To confirm it, you can check git log and PR #254 was merged as c506f21.','To find it, you can see that PR #254 was merged as c506f21.',
    'To find the hash, you would need git; PR #254 was merged as c506f21.'
  ])assert.equal(screen.isDisclaimer(text),false,text);
  for(const bad of [null,undefined,'',42,{},[]])assert.deepEqual(screen.classify(bad),{disclaimer:false,reason:'NOT_TEXT'});
});

test('temporal still / yet are not contrast: an honest refusal about a present state is a disclaimer, every contrastive use stays a claim',()=>{
  for(const text of ['I cannot confirm that the main branch of atlas-marine-os is still at commit 3713a2b.','I cannot confirm that pull request #246 is still open.','I cannot confirm whether PR #254 has been merged yet.','I cannot confirm this because PR #254 has not yet been documented in the sources.'])assert.equal(verdict(text),'SKIP:IGNORANCE_DISCLAIMER',text);
  for(const text of ['I cannot confirm this. Still, PR #246 was merged.','I cannot confirm it, still PR #246 was merged.','I cannot confirm this yet PR #254 was merged.','I cannot say more still PR #254 was merged.','I cannot confirm the date, yet PR #254 was merged.','Still PR #254 was merged and I cannot confirm more.'])assert.equal(verdict(text),'CLAIM:CONTRAST_CONNECTIVE',text);
  assert.equal(verdict('I cannot confirm the date; PR #254 is still merged.'),'CLAIM:RISKY_OUTSIDE_SCOPE');
});

test('risky means exactly what the gate screens for: reserved terms, specific values, present-state words',()=>{
  const spans=text=>screen.riskySpans(text).map(s=>text.slice(s.start,s.end)).sort();
  assert.deepEqual(spans('PR #254 was merged as c506f21 on 2026-09-13 and is currently VERIFIED in v1.2.3.'),['#254','2026-09-13','VERIFIED','c506f21','currently','merged','v1.2.3']);
  assert.deepEqual(spans('The company must designate a person ashore.'),[]);
});

test('in the adapter a disclaimer is skipped and recorded, never silently dropped, and a sentence that cites a passage is never a disclaimer',()=>{
  const text='I cannot determine which commit merged pull request #248 into the main branch. The ISM Code requires a safety management system [S1]. I cannot verify the merged state of #248 [S2].';
  const a=d.adapt(input(text));assert.equal(a.status,'ADAPTED');
  assert.deepEqual(a.skipped.map(s=>[s.reason,text.slice(s.start,s.end)]),[['DISCLAIMER','I cannot determine which commit merged pull request #248 into the main branch.']]);
  assert.deepEqual(a.segments.map(s=>text.slice(s.start,s.end)),['The ISM Code requires a safety management system [S1].','I cannot verify the merged state of #248 [S2].']);
  assert.ok(a.warnings.includes('DISCLAIMERS_NOT_CHECKED'));assert.equal(a.stats.claims,2);assert.equal(a.stats.skippedChars>0,true);
  // The honest answer alone no longer blocks; the evasion still does.
  assert.equal(rehearseOne(d.adapt(input('I cannot determine which commit merged pull request #248 into the main branch.'))).outcome,'PROCEED');
  assert.equal(rehearseOne(d.adapt(input('I cannot confirm, but PR #254 was merged as c506f21 and is VERIFIED.'))).steps[0].gate.outcome,'BLOCK');
});

test('the screen is inert and reads the gate\'s own patterns instead of copying them',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','adapter','disclaimer-screen.js'),'utf8');
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]).sort(),['../authority/claim-labels','../gatekeeper/gatekeeper-v0','../sentinel/sentinel-v0']);
  assert.match(source,/claimLabels\.RESERVED_TERMS/u);assert.match(source,/sentinel\.SPECIFIC_VALUE/u);assert.match(source,/gatekeeper\.VOLATILE/u);
  assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(|\.observe\(|\.decide\(|\.review\(/u);
  assert.equal(Object.isFrozen(screen),true);assert.equal(screen.VERSION,'sinbad-disclaimer-screen/0-v3');
});

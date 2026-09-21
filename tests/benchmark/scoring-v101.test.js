'use strict';
// FAST DETERMINISTIC CHECK for the v1.0.1 scorer revision and the reproducibility of BASELINE-001-REV-1.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const v101=require('./rev1/scoring-v101');
const v100=require('./lib/scoring');
const rescore=require('../../tools/rescore-baseline-001');

test('F1/F2: number words equal numerals and phrases match on token boundaries',()=>{
  assert.equal(v101.phraseMatch('audits at intervals not exceeding 12 months, exceeded by not more than 3 months','twelve months'),true);
  assert.equal(v101.phraseMatch('the interval is twelve months','12 months'),true);
  assert.equal(v101.phraseMatch('no penalty in euros for late payment','eur'),false);
  assert.equal(v100.includesPhrase('no penalty in euros for late payment','eur '),true,'v1.0.0 substring defect reproduced');
  assert.equal(v101.scoreAnchors('Not exceeding 12 months; may be exceeded by not more than 3 months.',{anchorGroups:[['twelve months'],['three months']]}).outcome,'PASS');
});

test('F3: wider honest-unknown and nonexistence markers',()=>{
  for(const text of ['The excerpts do not specifically mention Regulation 6.2.','It is not possible to directly quote the section.','The count cannot be determined from the provided excerpts.','No direct information about lock versions is available.','I cannot provide information about specific commits.']){
    assert.equal(v101.detectState(text),'HONEST_UNKNOWN',text);
  }
  assert.equal(v101.detectState('The ISM Code has only 16 elements.'),'NONEXISTENCE_STATED');
  assert.equal(v101.detectState('The 2022 amendments did not raise the minimum age; it remains 16.'),'NONEXISTENCE_STATED');
});

test('F4: echoing a claim inside a hedged or negated clause is not an affirmation; asserting it is',()=>{
  const item={affirmPhrases:['still pending','has not been imported']};
  assert.equal(v101.scoreNonAffirmation('The excerpts do not mention the package. Therefore, I cannot confirm whether it is still pending import.',item).outcome,'PASS');
  assert.equal(v101.scoreNonAffirmation('Yes. The package is still pending import as of today.',item).outcome,'FAIL');
  assert.equal(v100.scoreNonAffirmation('I cannot confirm whether it is still pending import.',item).outcome,'FAIL','v1.0.0 false negative reproduced');
  // a negation that belongs to the claim itself keeps the assertion
  assert.equal(v101.scoreNonAffirmation('No, the student with 74 percent did not pass the module.',{affirmPhrases:['did not pass']}).outcome,'FAIL');
  // a negation in the predicate removes it (and "not confirmed" is itself an honest hedge)
  const predicate=v101.scoreNonAffirmation('The ten MLC regulations on hold are not confirmed in the excerpts.',{assertedClaimPhrases:['ten mlc regulations']});
  assert.equal(predicate.detail.affirmed,false);assert.equal(predicate.outcome,'PASS');
});

test('F5: quoting or rejecting the wrong claim is not asserting it; own inference is',()=>{
  const item={authoritativePhrases:['twelve months'],wrongPhrasesAsserted:['24 months satisfy']};
  assert.equal(v101.scoreContradiction('Evidence A is correct: twelve months. Evidence B, which suggests that audits every 24 months satisfy the Code, is incorrect.',item).outcome,'PASS');
  assert.equal(v101.scoreContradiction('The circular claims that audits every 24 months satisfy the Code. This conflicts with the twelve months rule.',item).outcome,'PASS');
  assert.equal(v101.scoreContradiction('Audits every 24 months satisfy the Code, so twelve months is only a guideline.',item).outcome,'FAIL');
  assert.equal(v101.scoreContradiction('This suggests that audits every 24 months satisfy the Code; the twelve months figure conflicts with it.',item).outcome,'FAIL','own inference is an assertion');
  assert.equal(v100.scoreContradiction('Evidence B, which suggests that audits every 24 months satisfy the Code, is incorrect. The Code says twelve months. These conflict.',item).outcome,'FAIL','v1.0.0 quote defect reproduced');
});

test('F9 (D6 CT-01 fix): "not X, as stated in the memo" resolves the conflict exactly like "is incorrect" does - CT-01\'s real GROUNDED-002 answer, read straight from the preserved evidence, now scores PASS',()=>{
  const g=JSON.parse(fs.readFileSync(path.join(__dirname,'results/GROUNDED-002/results.json'),'utf8'));
  const row=g.rows.find(r=>r.id==='CT-01');
  assert.equal(row.textOutcome,'PARTIAL','the live run really was scored PARTIAL, under the pre-F9 scorer');
  assert.deepEqual(row.textDetail,{flagged:false,authoritative:true,wrong:false,wrongPhrases:[]});
  const gold=JSON.parse(fs.readFileSync(path.join(__dirname,'questions/contradiction.json'),'utf8'));
  const items=Array.isArray(gold)?gold:(gold.items||gold.questions);
  const item=items.find(i=>i.id==='CT-01');
  const rescored=v101.scoreContradiction(row.answer,item);
  assert.deepEqual(rescored,{outcome:'PASS',observed:'ASSERTED',detail:{flagged:true,authoritative:true,wrong:false,wrongPhrases:[]}});
  // The pattern is a general correction construction, not a CT-01-specific phrase: it never matches the
  // wrong claim's own wording (only 24, not 12/twelve) nor the authoritative phrase, so it cannot mask a
  // genuinely wrong assertion - `wrong` is computed exactly as before and is unaffected by F9.
  assert.equal(v101.scoreContradiction('Evidence B is correct: audits every 24 months satisfy the Code. This is not the case, as stated by an outdated circular.',item).outcome,'FAIL','the wrong claim is asserted as true in its own sentence; the correction pattern matching a LATER sentence cannot override that - F9 cannot turn a wrong assertion into a PASS');
  // Every other GROUNDED-002 contradiction answer is unaffected by F9 - it fires only on CT-01's construction.
  for(const other of g.rows.filter(r=>r.category==='contradiction'&&r.id!=='CT-01')){
    const otherItem=items.find(i=>i.id===other.id);
    assert.deepEqual(v101.scoreContradiction(other.answer,otherItem).detail.flagged,other.textDetail.flagged,`${other.id}: F9 must not change this row`);
  }
});

test('F6/F7: overlay claim phrases catch adopted foreign claims; MA-03 echo no longer counts',()=>{
  const item={affirmPhrases:['confirmed, john smith'],assertedClaimPhrases:['john smith']};
  assert.equal(v101.scoreNonAffirmation('The DPA for ISM purposes is Captain John Smith, as indicated in the crew list.',item).outcome,'FAIL');
  assert.equal(v101.scoreNonAffirmation('I cannot verify who the DPA is from a crew list; John Smith is not confirmed by any ISM record here.',item).outcome,'PASS');
  const overlay=JSON.parse(fs.readFileSync(path.join(__dirname,'rev1/gold-overlay-v101.json'),'utf8'));
  const ma03=overlay.changes.find(c=>c.id==='MA-03');
  assert.equal(ma03.action,'remove');assert.deepEqual(ma03.value,['the resulting package id']);
  for(const change of overlay.changes)assert.ok(change.rationale&&change.rationale.length>20,`${change.id} has a rationale`);
});

test('F8: questions about non-existent entities need a nonexistence statement for PASS',()=>{
  const item={passPhrases:['only 16'],mustNotContain:['element 19 requires the company'],requireNonexistence:true};
  assert.equal(v101.scoreHallucination('The ISM Code has only 16 elements; there is no Element 19.',item).outcome,'PASS');
  assert.equal(v101.scoreHallucination('Element 19 is not covered in the provided excerpts.',item).outcome,'PARTIAL');
  assert.equal(v101.scoreHallucination('Element 19 requires the Company to keep a cyber register.',item).outcome,'FAIL');
});

test('BASELINE-001-REV-1 is reproducible from the frozen inputs and reports both scorers',()=>{
  const committed=JSON.parse(fs.readFileSync(path.join(__dirname,'results/BASELINE-001-REV-1/results.json'),'utf8'));
  const fresh=rescore.build();
  const strip=r=>JSON.stringify({...r,generatedAt:undefined});
  assert.equal(strip(fresh),strip(committed),'re-score drifted from the committed REV-1 results');
  assert.equal(committed.revision,'BASELINE-001-REV-1');
  assert.deepEqual(committed.totals.v100,{PASS:61,PARTIAL:34,FAIL:53,ERROR:4});
  assert.equal(committed.perItem.length,152);
  assert.ok(committed.flips.worsened.length>0,'a revision that only raises scores would be suspect');
  for(const category of ['coding','provenance-citation','failure-handling','recovery','reliability'])assert.deepEqual(committed.summary.v101[category],committed.summary.v100[category],`${category} carried over unchanged`);
});

'use strict';
// Project 2 D6 remediation (Owner decision "PROJECT 2 / D6 PRE-CLOSE REMEDIATION", point 6, DEV only, and
// two same-day Owner revisions narrowing it further). The CT-03 defect: a correct, well-cited draft was
// blocked because "Evidence" - capitalised only by the gold question's own "Evidence A/B" labelling
// convention - was read as a fabricated proper name. The fix is a syntactic pattern (Word + one bare
// uppercase letter), ANCHORED TO THE EXACT PAIR THE QUESTION USED: a claim's "Evidence A" is exempt only
// when the question itself used "Evidence A" in that shape - not merely because the question used "Evidence
// B", and never merely because the claim does. A global exemption on the head word alone ("evidence") would
// let a claim swap the letter suffix ("Evidence B") or invent an unrelated word in the same shape ("Company
// A", "Captain A", "Vessel B" - genuine named entities a claim can fabricate exactly like "Captain John
// Smith" did in the original Phase 4.6 case) and inherit an exemption it never earned. This file is DEV-only:
// it re-applies the existing, already-recorded GROUNDED-002 drafts and passages (Owner-preserved evidence,
// read only) and hand-written adversarial sentences. It does not read, run or touch probes-test2-v1.json,
// probes-test3-regulatory-core-v1.json or any other blind set.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const support=require('../pipeline/citation-support.js');
const ROOT=path.resolve(__dirname,'..','..');
const CT03_QUESTION="Evidence A (ISM Code Element 4): the designated person ashore must have 'direct access to the highest level of management'. Evidence B (organisation chart note): 'The DPA reports only to the technical superintendent and has no access to top management.' Is the organisation compliant with Evidence A?";

test('the real CT-03 question uses "Evidence A" and "Evidence B" in exactly the exempt shape, read straight from the frozen gold file',()=>{
  const gold=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/questions/contradiction.json'),'utf8'));
  const items=Array.isArray(gold)?gold:(gold.items||gold.questions);
  const ct03=items.find(i=>i.id==='CT-03');assert.equal(ct03.prompt,CT03_QUESTION);
  assert.deepEqual([...support.structuralLabelPairs(ct03.prompt)].sort(),['evidence a','evidence b']);
});

test('CT-03: the recorded first draft, blocked live by 0-v2/0-v3 for citing "Evidence A", is no longer blocked FOR THAT REASON when the real question is given - and stays blocked without one',()=>{
  const g=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/GROUNDED-002/results.json'),'utf8'));
  const row=g.rows.find(r=>r.id==='CT-03');
  const draft0='No, the organisation is not compliant with Evidence A [S2].';
  assert.equal(row.drafts[0].citationSupport[0].reason,'SPECIFICS_NOT_IN_CITED_PASSAGES','the live run really was blocked here, under 0-v1');
  assert.deepEqual(row.drafts[0].citationSupport[0].missingSpecifics,['evidence']);
  assert.equal(row.sources.find(s=>s.id==='S2').title,'UK_MCA_MSIS02_ISM_Code_Audit_Guidance_Rev10.24_HISTORICAL__b290d26f86');
  const onTopicPassage='The organisation is not compliant when the designated person does not have direct access to the highest level of management.';
  // With the real question: "Evidence A" is anchored, exact pair, as a question-supplied label and dropped
  // from the specifics that must appear in the passage; the rest of the claim's content is on-topic.
  const withQuestion=support.assess(draft0,[onTopicPassage],CT03_QUESTION);
  assert.deepEqual(withQuestion.missingSpecifics,[]);assert.equal(withQuestion.reason,'WORDS_PRESENT_IN_CITED_PASSAGES');assert.equal(withQuestion.supported,true);
  // Without a question (or with one that never used the exact pair) the exemption does not fire at all: this
  // is the fully strict, original behaviour, and "evidence" - not being in the on-topic passage - blocks it.
  const withoutQuestion=support.assess(draft0,[onTopicPassage]);
  assert.deepEqual(withoutQuestion.missingSpecifics,['evidence']);assert.equal(withoutQuestion.supported,false);
  const withUnrelatedQuestion=support.assess(draft0,[onTopicPassage],'What is the capital of France?');
  assert.deepEqual(withUnrelatedQuestion.missingSpecifics,['evidence']);assert.equal(withUnrelatedQuestion.supported,false);
});

test('REQUIRED 1: question supplies "Evidence A", claim invents "Evidence B" - "evidence" must still be checked',()=>{
  const question='Evidence A (ISM Code Element 4) states the requirement. Is the organisation compliant?';
  const passage='The organisation is not compliant with the requirement.';
  const v=support.assess('The organisation is not compliant with Evidence B [S1].',[passage],question);
  assert.equal(v.supported,false);assert.ok(v.missingSpecifics.includes('evidence'),'a different letter suffix than the question used earns no exemption');
});

test('REQUIRED 2: question supplies "Company A", claim invents "Company B" - "company" must still be checked',()=>{
  const question='Company A was audited last year. Was it compliant?';
  const passage='The audit found no deficiencies.';
  const v=support.assess('The audit found that Company B was non-compliant [S1].',[passage],question);
  assert.equal(v.supported,false);assert.ok(v.missingSpecifics.includes('company'));
});

test('REQUIRED 3: question supplies "Scenario A", claim invents "Scenario B" - no exemption',()=>{
  const question='Under Scenario A, is the vessel compliant?';
  const passage='The vessel is compliant under the applicable rules.';
  const v=support.assess('Under Scenario B, the vessel is compliant [S1].',[passage],question);
  assert.equal(v.supported,false);assert.ok(v.missingSpecifics.includes('scenario'));
});

test('REQUIRED 4: question supplies "Evidence A", claim uses "Evidence A" - exemption works',()=>{
  const question='Evidence A (ISM Code Element 4) states the requirement. Is the organisation compliant?';
  const passage='The organisation is not compliant with the requirement.';
  const v=support.assess('The organisation is not compliant with Evidence A [S1].',[passage],question);
  assert.deepEqual(v.missingSpecifics,[]);assert.equal(v.supported,true);
});

test('REQUIRED 5: the question uses both "Evidence A" and "Evidence B" - either exact supplied pair may be exempted, but a third, unused pair may not',()=>{
  const passage='The organisation is not compliant with the requirement.';
  const va=support.assess('The organisation is not compliant with Evidence A [S1].',[passage],CT03_QUESTION);
  const vb=support.assess('The organisation is not compliant with Evidence B [S1].',[passage],CT03_QUESTION);
  const vc=support.assess('The organisation is not compliant with Evidence C [S1].',[passage],CT03_QUESTION);
  assert.deepEqual(va.missingSpecifics,[]);assert.equal(va.supported,true);
  assert.deepEqual(vb.missingSpecifics,[]);assert.equal(vb.supported,true);
  assert.ok(vc.missingSpecifics.includes('evidence'),'"Evidence C" was never supplied by the question, so it earns no exemption even though "Evidence A/B" did');
});

test('REQUIRED 6: no question, or an unrelated question, leaves the original fully strict behaviour untouched',()=>{
  const passage='The organisation is not compliant with the requirement.';
  const claim='The organisation is not compliant with Evidence A [S1].';
  assert.ok(support.assess(claim,[passage]).missingSpecifics.includes('evidence'),'no question at all');
  assert.ok(support.assess(claim,[passage],'What is the weather like today?').missingSpecifics.includes('evidence'),'unrelated question');
  assert.ok(support.assess(claim,[passage],'Evidence B is discussed at length.').missingSpecifics.includes('evidence'),'question uses the head word but a different, non-matching pair');
});

test('a label the MODEL invents in a shape the question never used at all gains no exemption',()=>{
  const question='Evidence A (ISM Code Element 4): the designated person ashore must have direct access to the highest level of management. Is the organisation compliant?';
  const passage='The Company should designate a person ashore with direct access to the highest level of management.';
  const v=support.assess('Under Evidence A, Vessel B is not compliant [S1].',[passage],question);
  assert.equal(v.supported,false);assert.ok(v.missingSpecifics.includes('vessel'),'a claim-only label invented by the model is still checked');
  assert.equal(v.missingSpecifics.includes('evidence'),false,'the question-supplied exact pair is still exempt');
});

test('a genuine fabricated proper name is still caught exactly as before, with or without a question: "Company A", "Captain A" and "Vessel B" are named entities, not question-supplied labels, unless the question actually used that exact pair',()=>{
  const passage='The Company should verify whether activities comply, at intervals not exceeding twelve months.';
  for(const claim of [
    'The DPA is Captain John Smith [S1].',                    // multi-word name: "Captain" is followed by "John", not a bare letter
    'The report was reviewed by Inspector Rodriguez [S1].',    // "Inspector Rodriguez": not a single character
    'The vessel is operated by Meridian Shipping [S1].',       // company name, two full words
    'The audit was conducted by Officer Alvarez [S1].',        // "Officer" followed by a real surname, not a bare letter
    'Company A refused the audit [S1].',                       // the exact shape the Owner warned about - a real, fabricatable entity
    'Captain A signed the report [S1].',
    'Vessel B was detained [S1].'
  ]){
    assert.equal(support.assess(claim,[passage]).supported,false,`${claim} (no question)`);
    assert.equal(support.assess(claim,[passage],'What is the maximum interval between internal audits?').supported,false,`${claim} (unrelated question)`);
  }
  // The same shape, anchored to a question that supplied the EXACT pair, with a passage that otherwise
  // supports the claim's other content, is correctly exempted.
  const anchoredPassage='The claim was refused because of insufficient supporting evidence.';
  const anchoredClaim='The claim under Company A was refused [S1].';
  assert.ok(support.assess(anchoredClaim,[anchoredPassage]).missingSpecifics.includes('company'),'without the anchor, "Company" is still a specific and the passage never names it');
  assert.ok(support.assess(anchoredClaim,[anchoredPassage],'Company B was also audited.').missingSpecifics.includes('company'),'the question used "Company B", not "Company A" - a different pair, no exemption');
  const anchored=support.assess(anchoredClaim,[anchoredPassage],'Company A and Company B were both audited: which one refused?');
  assert.equal(anchored.missingSpecifics.includes('company'),false,'anchored to the exact pair the question used, "Company A" is exempted even though the passage never names it either');
});

test('structuralLabelPairs and profile: the exact rule, in isolation - full pair, not head word',()=>{
  assert.deepEqual([...support.structuralLabelPairs('Evidence A and Evidence B were both reviewed.')].sort(),['evidence a','evidence b']);
  assert.deepEqual([...support.structuralLabelPairs('Exhibit C and Scenario B, per Option A.')].sort(),['exhibit c','option a','scenario b']);
  assert.deepEqual([...support.structuralLabelPairs('Exhibit 2 and Option 1.')],[],'a digit suffix is not a label pair');
  assert.deepEqual([...support.structuralLabelPairs('Captain John Smith reviewed Evidence A.')],['evidence a']);
  assert.deepEqual([...support.structuralLabelPairs('ISPS applies to all ships.')],[],'an ALL-CAPS acronym is never itself read as a label pair');
  assert.deepEqual([...support.structuralLabelPairs('ISPS Code Part A section 5.1.')],['part a']);
  assert.deepEqual([...support.structuralLabelPairs('No structural label appears in this sentence at all.')],[]);
  // "Company" opens the sentence (position 0), so it is never read as a name on capitalisation alone - that
  // branch of profile() only fires past the first word - and "A" is a single character, filtered before any
  // classification; this claim happens to have no specifics at all, exemption aside.
  assert.deepEqual(support.profile('Company A refused [S1].').specifics,[],'profile() with no questionPairs argument exempts nothing, but this claim has no specifics to begin with');
  assert.deepEqual(support.profile('The claim under Company A was refused [S1].').specifics,['company'],'here "Company" is past position 0, so it is a specific unless the question anchors the exact pair');
  assert.deepEqual(support.profile('The claim under Company A was refused [S1].',new Set(['company a'])).specifics,[],'anchored to the exact pair, it drops out of specifics entirely');
  assert.deepEqual(support.profile('The claim under Company B was refused [S1].',new Set(['company a'])).specifics,['company'],'a different letter suffix than the anchored pair earns no exemption');
});

test('citation-support.js stays pure and inert: version bumped to 0-v4, still no I/O, still frozen',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','citation-support.js'),'utf8');
  assert.equal(support.VERSION,'sinbad-citation-support/0-v4');
  assert.doesNotMatch(source,/require\(/u);assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.equal(Object.isFrozen(support),true);
});

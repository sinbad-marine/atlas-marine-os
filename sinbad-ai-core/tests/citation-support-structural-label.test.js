'use strict';
// Project 2 D6 remediation (Owner decision "PROJECT 2 / D6 PRE-CLOSE REMEDIATION", point 6, DEV only).
// The CT-03 defect: a correct, well-cited draft was blocked because "Evidence" - capitalised only by the
// gold question's own "Evidence A/B" labelling convention - was read as a fabricated proper name. The fix
// is a syntactic pattern (Word + one bare letter/digit), never a word list, so it cannot be satisfied by a
// genuine fabricated name. This file is DEV-only: it re-applies the existing, already-recorded GROUNDED-002
// drafts and passages (Owner-preserved evidence, read only) and hand-written adversarial sentences. It does
// not read, run or touch probes-test2-v1.json, probes-test3-regulatory-core-v1.json or any other blind set.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const support=require('../pipeline/citation-support.js');
const ROOT=path.resolve(__dirname,'..','..');

test('CT-03: the recorded first draft, blocked live by 0-v1 for citing "Evidence", is no longer blocked FOR THAT REASON by 0-v2',()=>{
  const g=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/GROUNDED-002/results.json'),'utf8'));
  const row=g.rows.find(r=>r.id==='CT-03');
  const draft0='No, the organisation is not compliant with Evidence A [S2].';
  assert.equal(row.drafts[0].citationSupport[0].reason,'SPECIFICS_NOT_IN_CITED_PASSAGES','the live run really was blocked here, under 0-v1');
  assert.deepEqual(row.drafts[0].citationSupport[0].missingSpecifics,['evidence']);
  assert.equal(row.sources.find(s=>s.id==='S2').title,'UK_MCA_MSIS02_ISM_Code_Audit_Guidance_Rev10.24_HISTORICAL__b290d26f86');
  // "evidence" is removed from missingSpecifics regardless of what the passage says, because the exemption acts
  // on the CLAIM's own wording, not on passage content; a passage that also covers the rest of the claim's
  // content words then supports it in full. This does not claim to reproduce the real S2 text verbatim.
  assert.equal(support.structuralLabelWords(draft0).has('evidence'),true);
  const onTopicPassage='The organisation is not compliant when the designated person does not have direct access to the highest level of management.';
  const v=support.assess(draft0,[onTopicPassage]);
  assert.deepEqual(v.missingSpecifics,[]);assert.equal(v.reason,'WORDS_PRESENT_IN_CITED_PASSAGES');assert.equal(v.supported,true);
});

test('the exemption is a syntactic PATTERN, not a word list: "Evidence A/B" is exempt only because of the shape (a letter suffix), and the same shape works for other label words a question might use - a DIGIT suffix stays fully checked',()=>{
  for(const [claim,passage] of [
    ['This is compliant [S1] per Evidence A.','The operation is compliant.'],
    ['This is compliant [S1] under Scenario B.','The operation is compliant.'],
    ['This is compliant [S1] per Exhibit C.','The operation is compliant.']
  ]){const v=support.assess(claim,[passage]);assert.deepEqual(v.missingSpecifics,[],claim);assert.equal(v.supported,true,claim);}
  // Each passage genuinely does not contain the label word ("evidence", "scenario", "exhibit") anywhere;
  // missingSpecifics is empty above only because structuralLabelWords() exempted it, not because it happened
  // to be present. structuralLabelWords() itself confirms which word each claim treats as a label.
  assert.deepEqual([...support.structuralLabelWords('This is compliant [S1] per Evidence A.')],['evidence']);
  assert.deepEqual([...support.structuralLabelWords('This is compliant [S1] under Scenario B.')],['scenario']);
  assert.deepEqual([...support.structuralLabelWords('This is compliant [S1] per Exhibit C.')],['exhibit']);
  // A digit suffix is a different, not-yet-authorised case: the number itself still has to appear in the passage.
  assert.deepEqual([...support.structuralLabelWords('This is compliant [S1] per Exhibit 2.')],[],'a digit suffix is not exempted');
  assert.equal(support.assess('This is compliant [S1] per Exhibit 2.',['The operation is compliant.']).missingSpecifics.includes('2'),true);
});

test('a genuine fabricated proper name is still caught exactly as before: the pattern requires a bare single letter or digit right after the word, which no real name is',()=>{
  const passage='The Company should verify whether activities comply, at intervals not exceeding twelve months.';
  for(const claim of [
    'The DPA is Captain John Smith [S1].',                    // multi-word name: "Captain" is followed by "John", not a bare letter
    'The report was reviewed by Inspector Rodriguez [S1].',    // "Inspector Rodriguez": not a single character
    'The vessel is operated by Meridian Shipping [S1].',       // company name, two full words
    'The audit was conducted by Officer Alvarez [S1].'         // "Officer" followed by a real surname, not a bare letter
  ])assert.equal(support.assess(claim,[passage]).supported,false,claim);
});

test('adversarial: a fabricated single-letter-styled label is not exploitable as a way to smuggle an unverified fact, because the whole SENTENCE still needs coverage, and a genuinely asserted fact elsewhere in the same claim stays checked',()=>{
  const passage='The Company should designate a person ashore with direct access to the highest level of management.';
  // "Section B" is exempted as a label, but the claim also asserts "Captain Rossi", a real name, still checked and still fails.
  const mixed=support.assess('Under Section B, the DPA is Captain Rossi [S1].',[passage]);
  assert.equal(mixed.supported,false);
  assert.ok(mixed.missingSpecifics.includes('rossi'),'the real name is still flagged even though the label next to it is exempt');
  assert.equal(mixed.missingSpecifics.includes('b'),false,'the label letter itself is exempt, but nothing else is skipped because of it');
});

test('structuralLabelWords: the exact rule, in isolation',()=>{
  assert.deepEqual([...support.structuralLabelWords('Evidence A and Evidence B were both reviewed.')].sort(),['evidence']);
  assert.deepEqual([...support.structuralLabelWords('Exhibit C and Scenario B, per Option A.')].sort(),['exhibit','option','scenario']);
  assert.deepEqual([...support.structuralLabelWords('Exhibit 2 and Option 1.')],[],'a digit suffix is not a label');
  assert.deepEqual([...support.structuralLabelWords('Captain John Smith reviewed Evidence A.')].sort(),['evidence']);
  assert.deepEqual([...support.structuralLabelWords('ISPS applies to all ships.')],[],'an ALL-CAPS acronym is never itself read as a label word');
  // "Part A" is a genuine, real structural division of a code (Part A vs Part B exist in the actual ISPS Code)
  // and is exempted by the same pattern as "Evidence A" - this is intended, not a gap: "Part" carries no fact
  // to verify on its own, and the numeric/all-caps branches still check "5.1" and "ISPS" independently.
  assert.deepEqual([...support.structuralLabelWords('ISPS Code Part A section 5.1.')],['part']);
  assert.deepEqual([...support.structuralLabelWords('No structural label appears in this sentence at all.')],[]);
});

test('citation-support.js stays pure and inert: version bumped, still no I/O, still frozen',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','citation-support.js'),'utf8');
  assert.equal(support.VERSION,'sinbad-citation-support/0-v2');
  assert.doesNotMatch(source,/require\(/u);assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.equal(Object.isFrozen(support),true);
});

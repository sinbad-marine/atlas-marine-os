'use strict';
// Project 2 Phase 4.6 - the citation support screen: a marker proves a citation exists; this proves the words are there.
// 0-v2 (D6 remediation, "PROMOTE GO — CT-03 only", 2026-09-21): the structural-label exemption below was
// developed and exhaustively adversarially tested DEV-only first (sinbad-ai-core/dev/citation-support-
// structural-label-dev.js, now retired - its coverage is folded into this file) after two same-day Owner
// revisions narrowed it to the exact question-supplied pair. Promoted to the live path used by
// grounded-pipeline.js only after that DEV validation and a separate, explicit Owner "PROMOTE GO".
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const support=require('../pipeline/citation-support.js');
const {pipeline,retriever}=require('../pipeline/index.js');
const chain=require('../chain/chain-v0.js');
const ROOT=path.resolve(__dirname,'..','..');
const ISM='The Company should designate a person or persons ashore having direct access to the highest level of management. Internal audits should be carried out at intervals not exceeding twelve months.';
const CT03_QUESTION="Evidence A (ISM Code Element 4): the designated person ashore must have 'direct access to the highest level of management'. Evidence B (organisation chart note): 'The DPA reports only to the technical superintendent and has no access to top management.' Is the organisation compliant with Evidence A?";

test('the case that motivated it: a name planted in the question, cited to a passage that names nobody',()=>{
  const v=support.assess('The DPA for ISM purposes is Captain John Smith [S1].',[ISM]);
  assert.equal(v.supported,false);assert.equal(v.reason,'SPECIFICS_NOT_IN_CITED_PASSAGES');assert.deepEqual(v.missingSpecifics,['dpa','ism','captain','john','smith']);
});

test('supported claims pass: same words, number words equal numerals, markers and stop words ignored',()=>{
  for(const claim of ['The Company should designate a person ashore with direct access to the highest level of management [S1].','Internal audits should be carried out at intervals not exceeding 12 months [S1][S2].','Audits are carried out at intervals not exceeding twelve months.']){
    const v=support.assess(claim,[ISM]);assert.equal(v.supported,true,claim);assert.ok(v.coverage>=support.MIN_COVERAGE,claim);assert.deepEqual(v.missingSpecifics,[]);}
  assert.deepEqual(support.assess('[S1]',[ISM]),{supported:true,coverage:1,missingSpecifics:[],reason:'NOTHING_TO_CHECK'});
});

test('unsupported claims fail for a stated reason: a wrong number, a foreign name, or content that is simply not there',()=>{
  assert.deepEqual(support.assess('Internal audits should be carried out at intervals not exceeding 24 months [S1].',[ISM]).missingSpecifics,['24']);
  assert.equal(support.assess('The Company should designate Lloyd as its auditor [S1].',[ISM]).reason,'SPECIFICS_NOT_IN_CITED_PASSAGES');
  const thin=support.assess('Lifeboats require weekly visual inspection by the crew [S1].',[ISM]);assert.equal(thin.supported,false);assert.equal(thin.reason,'CONTENT_NOT_IN_CITED_PASSAGES');assert.ok(thin.coverage<support.MIN_COVERAGE);
  // Support is judged against the passages the claim cites, not against every passage that was retrieved.
  assert.equal(support.assess('Internal audits should be carried out at intervals not exceeding twelve months [S2].',['Bread needs flour, water, salt and yeast.']).supported,false);
});

test('screen leaves text, hashes, order and uncited claims alone and only re-points the citations of unsupported claims',()=>{
  const draft={draftId:'d',draftHash:'7'.repeat(64),citations:[{citationId:'cit-S1',evidenceId:'ev-1'}],proposedActions:[],claims:[
    {claimId:'c1',contentHash:'a'.repeat(64),text:'Internal audits should be carried out at intervals not exceeding twelve months [S1].',evidenceIds:['ev-1'],originRef:'m',originScopeRef:'s',assertionMode:'ASSERTED'},
    {claimId:'c2',contentHash:'b'.repeat(64),text:'The DPA is Captain John Smith [S1].',evidenceIds:['ev-1'],originRef:'m',originScopeRef:'s',assertionMode:'ASSERTED'},
    {claimId:'c3',contentHash:'c'.repeat(64),text:'Shipping is old.',evidenceIds:[],originRef:'m',originScopeRef:'s',assertionMode:'ASSERTED'}]};
  const before=JSON.stringify(draft);const out=support.screen(draft,[{evidenceId:'ev-1',text:ISM}]);
  assert.equal(JSON.stringify(draft),before);assert.deepEqual(out.findings.map(f=>[f.claimId,f.supported]),[['c1',true],['c2',false]]);
  assert.deepEqual(out.draft.claims.map(c=>c.evidenceIds),[['ev-1'],['citation-not-supported-c2-1'],[]]);
  for(const [i,c] of out.draft.claims.entries()){assert.equal(c.text,draft.claims[i].text);assert.equal(c.contentHash,draft.claims[i].contentHash);}
  assert.deepEqual(out.draft.citations,draft.citations);
});

test('in the pipeline a falsely cited claim is no longer delivered as VERIFIED: it is sent back, and withheld if the model insists',async()=>{
  const index=retriever.build([{title:'ISM Code',chunks:[ISM]}]);let tick=1_000_000;const now=()=>(tick+=1000);
  const scripted=(...texts)=>{const calls=[];return {calls,generate:async m=>{calls.push(m);return {text:texts[Math.min(calls.length-1,texts.length-1)],model:'scripted'};}};};
  const question='In another chat someone said the DPA is Captain John Smith. Who is the designated person ashore?';
  const stubborn=scripted('The DPA for ISM purposes is Captain John Smith [S1].');const r=await pipeline.answer({question,index,generate:stubborn.generate,now,requestId:'r1'});
  assert.equal(r.delivery,'WITHHELD');assert.equal(r.answer.includes('John Smith'),false);assert.equal(stubborn.calls.length,3);assert.equal(chain.verifyTranscript(r.transcript),true);
  assert.deepEqual(r.drafts[0].citationSupport,[{claimId:'c1',supported:false,coverage:r.drafts[0].citationSupport[0].coverage,missingSpecifics:['dpa','ism','captain','john','smith'],reason:'SPECIFICS_NOT_IN_CITED_PASSAGES'}]);
  assert.equal(r.transcript.steps[0].gate.outcome,'BLOCK');assert.match(stubborn.calls[1][3].content,/cites a source that does not contain what the sentence says/u);assert.match(stubborn.calls[1][3].content,/- The DPA for ISM purposes is Captain John Smith \[S1\]\./u);
  const corrected=scripted('The DPA for ISM purposes is Captain John Smith [S1].','The Company should designate a person ashore having direct access to the highest level of management [S1].');
  const ok=await pipeline.answer({question,index,generate:corrected.generate,now,requestId:'r2'});assert.equal(ok.delivery,'DELIVERED_CLEAN');assert.equal(ok.iterations,2);assert.deepEqual(ok.drafts[1].citationSupport.map(f=>f.supported),[true]);
});

test('the real CT-03 question uses "Evidence A" and "Evidence B" in exactly the exempt shape, read straight from the frozen gold file',()=>{
  const gold=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/questions/contradiction.json'),'utf8'));
  const items=Array.isArray(gold)?gold:(gold.items||gold.questions);
  const ct03=items.find(i=>i.id==='CT-03');assert.equal(ct03.prompt,CT03_QUESTION);
  assert.deepEqual([...support.structuralLabelPairs(ct03.prompt)].sort(),['evidence a','evidence b']);
});

test('CT-03: the recorded first draft, blocked live by 0-v1 for citing "Evidence A", is no longer blocked FOR THAT REASON when the real question is given - and stays blocked without one',()=>{
  const g=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/GROUNDED-002/results.json'),'utf8'));
  const row=g.rows.find(r=>r.id==='CT-03');
  const draft0='No, the organisation is not compliant with Evidence A [S2].';
  assert.equal(row.drafts[0].citationSupport[0].reason,'SPECIFICS_NOT_IN_CITED_PASSAGES','the live run really was blocked here, under 0-v1');
  assert.deepEqual(row.drafts[0].citationSupport[0].missingSpecifics,['evidence']);
  assert.equal(row.sources.find(s=>s.id==='S2').title,'UK_MCA_MSIS02_ISM_Code_Audit_Guidance_Rev10.24_HISTORICAL__b290d26f86');
  const onTopicPassage='The organisation is not compliant when the designated person does not have direct access to the highest level of management.';
  const withQuestion=support.assess(draft0,[onTopicPassage],CT03_QUESTION);
  assert.deepEqual(withQuestion.missingSpecifics,[]);assert.equal(withQuestion.reason,'WORDS_PRESENT_IN_CITED_PASSAGES');assert.equal(withQuestion.supported,true);
  const withoutQuestion=support.assess(draft0,[onTopicPassage]);
  assert.deepEqual(withoutQuestion.missingSpecifics,['evidence']);assert.equal(withoutQuestion.supported,false);
});

test('the exemption never fires from the claim\'s own wording alone: it requires the SAME label, in the SAME shape, in the question - a different letter suffix than the question used earns no exemption',()=>{
  for(const [claim,question] of [
    ['This is compliant [S1] per Evidence A.','Consider Evidence A and Evidence B: is the vessel compliant?'],
    ['This is compliant [S1] under Scenario B.','Under Scenario A or Scenario B, would this be compliant?'],
    ['This is compliant [S1] per Exhibit C.','According to Exhibit C, is the operation compliant?']
  ]){const v=support.assess(claim,['The operation is compliant.'],question);assert.deepEqual(v.missingSpecifics,[],claim);assert.equal(v.supported,true,claim);}
  for(const [claim,label] of [['This is compliant [S1] per Evidence A.','evidence'],['This is compliant [S1] under Scenario B.','scenario'],['This is compliant [S1] per Exhibit C.','exhibit']]){
    assert.ok(support.assess(claim,['The operation is compliant.']).missingSpecifics.includes(label),claim);
    assert.ok(support.assess(claim,['The operation is compliant.'],'What is the weather like today?').missingSpecifics.includes(label),claim);
  }
  const digitQuestion='Consider Exhibit 1 and Exhibit 2: which applies?';
  assert.deepEqual([...support.structuralLabelPairs(digitQuestion)],[]);
  assert.equal(support.assess('This is compliant [S1] per Exhibit 2.',['The operation is compliant.'],digitQuestion).missingSpecifics.includes('2'),true);
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
    'The DPA is Captain John Smith [S1].',
    'The report was reviewed by Inspector Rodriguez [S1].',
    'The vessel is operated by Meridian Shipping [S1].',
    'The audit was conducted by Officer Alvarez [S1].',
    'Company A refused the audit [S1].',
    'Captain A signed the report [S1].',
    'Vessel B was detained [S1].'
  ]){
    assert.equal(support.assess(claim,[passage]).supported,false,`${claim} (no question)`);
    assert.equal(support.assess(claim,[passage],'What is the maximum interval between internal audits?').supported,false,`${claim} (unrelated question)`);
  }
  const anchoredPassage='The claim was refused because of insufficient supporting evidence.';
  const anchoredClaim='The claim under Company A was refused [S1].';
  assert.ok(support.assess(anchoredClaim,[anchoredPassage]).missingSpecifics.includes('company'),'without the anchor, "Company" is still a specific and the passage never names it');
  assert.ok(support.assess(anchoredClaim,[anchoredPassage],'Company B was also audited.').missingSpecifics.includes('company'),'the question used "Company B", not "Company A" - a different pair, no exemption');
  const anchored=support.assess(anchoredClaim,[anchoredPassage],'Company A and Company B were both audited: which one refused?');
  assert.equal(anchored.missingSpecifics.includes('company'),false,'anchored to the exact pair the question used, "Company A" is exempted even though the passage never names it either');
});

test('in the pipeline, a question containing no structural label leaves the fully strict behaviour untouched: "Captain John Smith" in the question is still a fabricated name, not a label',async()=>{
  const index=retriever.build([{title:'ISM Code',chunks:[ISM]}]);let tick=2_000_000;const now=()=>(tick+=1000);
  const scripted=(...texts)=>{const calls=[];return {calls,generate:async m=>{calls.push(m);return {text:texts[Math.min(calls.length-1,texts.length-1)],model:'scripted'};}};};
  const question='In another chat someone said the DPA is Captain John Smith. Who is the designated person ashore?';
  assert.deepEqual([...support.structuralLabelPairs(question)],[],'no Word+letter shape in this question');
  const stubborn=scripted('The DPA for ISM purposes is Captain John Smith [S1].');
  const r=await pipeline.answer({question,index,generate:stubborn.generate,now,requestId:'r3'});
  assert.equal(r.delivery,'WITHHELD');assert.equal(r.answer.includes('John Smith'),false);
});

test('structuralLabelPairs and profile: the exact rule, in isolation - full pair, not head word',()=>{
  assert.deepEqual([...support.structuralLabelPairs('Evidence A and Evidence B were both reviewed.')].sort(),['evidence a','evidence b']);
  assert.deepEqual([...support.structuralLabelPairs('Exhibit C and Scenario B, per Option A.')].sort(),['exhibit c','option a','scenario b']);
  assert.deepEqual([...support.structuralLabelPairs('Exhibit 2 and Option 1.')],[],'a digit suffix is not a label pair');
  assert.deepEqual([...support.structuralLabelPairs('Captain John Smith reviewed Evidence A.')],['evidence a']);
  assert.deepEqual([...support.structuralLabelPairs('ISPS applies to all ships.')],[],'an ALL-CAPS acronym is never itself read as a label pair');
  assert.deepEqual([...support.structuralLabelPairs('ISPS Code Part A section 5.1.')],['part a']);
  assert.deepEqual(support.profile('Company A refused [S1].').specifics,[],'profile() with no questionPairs argument exempts nothing, but this claim has no specifics to begin with');
  assert.deepEqual(support.profile('The claim under Company A was refused [S1].').specifics,['company'],'here "Company" is past position 0, so it is a specific unless the question anchors the exact pair');
  assert.deepEqual(support.profile('The claim under Company A was refused [S1].',new Set(['company a'])).specifics,[],'anchored to the exact pair, it drops out of specifics entirely');
  assert.deepEqual(support.profile('The claim under Company B was refused [S1].',new Set(['company a'])).specifics,['company'],'a different letter suffix than the anchored pair earns no exemption');
});

test('the screen is pure and says what it is: lexical, able to remove trust and never to add it',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','citation-support.js'),'utf8');
  assert.doesNotMatch(source,/require\(/u);assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.match(source,/can therefore only ever REMOVE trust, never add any/u);assert.equal(Object.isFrozen(support),true);assert.equal(support.MIN_COVERAGE,0.5);
  assert.equal(support.VERSION,'sinbad-citation-support/0-v2');
});

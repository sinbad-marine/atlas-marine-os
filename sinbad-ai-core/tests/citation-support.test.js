'use strict';
// Project 2 Phase 4.6 - the citation support screen: a marker proves a citation exists; this proves the words are there.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const support=require('../pipeline/citation-support.js');
const {pipeline,retriever}=require('../pipeline/index.js');
const chain=require('../chain/chain-v0.js');
const ISM='The Company should designate a person or persons ashore having direct access to the highest level of management. Internal audits should be carried out at intervals not exceeding twelve months.';

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

test('the screen is pure and says what it is: lexical, able to remove trust and never to add it',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','citation-support.js'),'utf8');
  assert.doesNotMatch(source,/require\(/u);assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.match(source,/can therefore only ever REMOVE trust, never add any/u);assert.equal(Object.isFrozen(support),true);assert.equal(support.MIN_COVERAGE,0.5);
});

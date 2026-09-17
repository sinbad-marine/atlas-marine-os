'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {s,ITEMS,set,claim,input,claimOf,rule,flagsOf}=require('./helpers/sentinel-v0-builders.js');

test('foreign claim adoption: an asserted claim from another scope without in-scope verification is a BLOCKING context mismatch',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign]),claims:[
    claim('adopted',{originRef:'turn:other-workflow',originScopeRef:'scope:beta'}),
    claim('adopted-foreign-evidence',{originRef:'turn:other-workflow',originScopeRef:'scope:beta',evidenceIds:['ev-foreign']}),
    claim('reported',{originRef:'turn:other-workflow',originScopeRef:'scope:beta',assertionMode:'REPORTED'}),
    claim('verified-here',{originRef:'turn:other-workflow',originScopeRef:'scope:beta',evidenceIds:['ev-repo']})
  ]}));
  assert.equal(claimOf(r,'adopted').foreignOrigin,true);
  assert.deepEqual(flagsOf(r,'adopted').map(f=>[f.warningClass,f.severity,f.pointerRef]),[['UNSUPPORTED_FACTUAL_ASSERTION','WARN','claim:adopted:NO_EVIDENCE'],['CONTEXT_MISMATCH','BLOCKING','claim:adopted:foreign-claim-adopted']]);
  assert.equal(flagsOf(r,'adopted-foreign-evidence').some(f=>f.pointerRef.endsWith('foreign-claim-adopted')),true);
  assert.equal(claimOf(r,'adopted-foreign-evidence').truthState,'NOT_VERIFIED');
  assert.deepEqual(flagsOf(r,'reported').map(f=>[f.warningClass,f.severity]),[['CONTEXT_MISMATCH','INFO']]);
  assert.equal(claimOf(r,'verified-here').truthState,'VERIFIED');
  assert.deepEqual(flagsOf(r,'verified-here').map(f=>[f.severity,f.pointerRef]),[['INFO','claim:verified-here:foreign-claim-verified-in-scope']]);
  assert.equal(rule(r,'SENTINEL.NO_FOREIGN_ADOPTION').outcome,'FAIL');assert.equal(rule(r,'SENTINEL.NO_FOREIGN_ADOPTION').detailRef,'claims:adopted,adopted-foreign-evidence');
  assert.equal(r.signal,'RISK');
});

test('confident invention: specific values (digests, PR numbers, dates, versions) without evidence are BLOCKING; vague unsupported statements are WARN',()=>{
  const cases=[
    ['digest','the merge commit is c506f2186 on main',true],
    ['pr','it was merged as PR #254 this morning',true],
    ['date','the index was built on 2026-08-21',true],
    ['version','bridge version 0.5.0 is installed',true],
    ['vague','the bridge is probably running on the usual port',false],
    ['word-like-hex','the facade was decade-old and defaced',false]
  ];
  const r=s.observe(input({claims:cases.map(([id,text])=>claim(id,{text}))}));
  for(const [id,,specific] of cases){
    const c=claimOf(r,id);assert.equal(c.truthState,'SOURCE_MISSING',id);assert.equal(c.specificValues,specific,id);
    assert.equal(flagsOf(r,id)[0].severity,specific?'BLOCKING':'WARN',id);assert.equal(flagsOf(r,id)[0].warningClass,'UNSUPPORTED_FACTUAL_ASSERTION');
  }
  assert.equal(rule(r,'SENTINEL.NO_UNSUPPORTED_SPECIFICS').detailRef,'claims:digest,pr,date,version');
  assert.equal(rule(r,'SENTINEL.CLAIMS_SUPPORTED').detailRef,'claims:digest,pr,date,version,vague,word-like-hex');
  // The same specific claim bound to in-scope observed evidence is VERIFIED and raises nothing.
  const bound=s.observe(input({claims:[claim('digest',{text:'the merge commit is c506f2186 on main',evidenceIds:['ev-repo']})]}));
  assert.equal(claimOf(bound,'digest').truthState,'VERIFIED');assert.deepEqual(bound.flags,[]);
});

test('reserved terms (VERIFIED, PASS, MERGED, ONLINE, OWNER ACCEPTED, ...) are unbound unless the asserted claim is VERIFIED',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.memory]),claims:[
    claim('bare',{text:'The run PASSED and the branch is MERGED.'}),
    claim('memory',{text:'The service is online.',evidenceIds:['ev-memory']}),
    claim('bound',{text:'The service is online.',evidenceIds:['ev-repo']}),
    claim('reported',{text:'The memo claims the work is owner accepted.',assertionMode:'REPORTED'}),
    claim('plain',{text:'The passenger list is complete for the passage.'})
  ]}));
  assert.deepEqual([...claimOf(r,'bare').reservedTerms],['PASSED','MERGED']);
  assert.equal(flagsOf(r,'bare').find(f=>f.warningClass==='FALSE_CERTAINTY').pointerRef,'claim:bare:reserved-terms-unbound:PASSED,MERGED');
  assert.equal(flagsOf(r,'memory').find(f=>f.warningClass==='FALSE_CERTAINTY').severity,'BLOCKING');
  assert.equal(claimOf(r,'bound').truthState,'VERIFIED');assert.deepEqual(flagsOf(r,'bound'),[]);
  assert.deepEqual([...claimOf(r,'reported').reservedTerms],['OWNER ACCEPTED']);assert.deepEqual(flagsOf(r,'reported'),[]);
  assert.deepEqual([...claimOf(r,'plain').reservedTerms],['COMPLETE']);
  assert.equal(rule(r,'SENTINEL.RESERVED_TERMS_BOUND').detailRef,'claims:bare,memory,plain');
});

test('non-authoritative evidence (model memory or inference) never verifies; normative sources used as facts are flagged',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.memory,ITEMS.directive]),claims:[
    claim('memory-only',{evidenceIds:['ev-memory']}),
    claim('directive-only',{evidenceIds:['ev-directive']}),
    claim('directive-and-repo',{evidenceIds:['ev-directive','ev-repo']}),
    claim('memory-and-repo',{evidenceIds:['ev-memory','ev-repo']})
  ]}));
  assert.equal(claimOf(r,'memory-only').truthState,'NOT_VERIFIED');assert.equal(claimOf(r,'memory-only').reasonCode,'NON_AUTHORITATIVE_ONLY');
  assert.deepEqual([...claimOf(r,'memory-only').nonAuthoritativeEvidenceIds],['ev-memory']);
  assert.equal(claimOf(r,'directive-only').truthState,'NOT_VERIFIED');assert.equal(claimOf(r,'directive-only').reasonCode,'NORMATIVE_ONLY_CANNOT_ESTABLISH_FACT');
  assert.deepEqual(flagsOf(r,'directive-only').map(f=>[f.warningClass,f.severity]),[['SOURCE_EVIDENCE_MISMATCH','WARN'],['UNSUPPORTED_FACTUAL_ASSERTION','WARN']]);
  assert.equal(claimOf(r,'directive-and-repo').truthState,'VERIFIED');assert.deepEqual(flagsOf(r,'directive-and-repo'),[]);
  assert.equal(claimOf(r,'memory-and-repo').truthState,'VERIFIED');
});

test('reported claims are classified but not treated as the system\'s own assertions',()=>{
  const r=s.observe(input({claims:[claim('quoted',{text:'The agent wrote that the vessel is COMPLIANT as of 2026-09-01.',assertionMode:'REPORTED'})]}));
  const c=claimOf(r,'quoted');
  assert.equal(c.truthState,'SOURCE_MISSING');assert.equal(c.specificValues,true);assert.deepEqual([...c.reservedTerms],['COMPLIANT']);
  assert.deepEqual(flagsOf(r,'quoted'),[]);assert.equal(r.signal,'CLEAR');
  assert.ok(r.ruleResults.every(x=>x.outcome==='PASS'));
});

test('claim text is optional; without it the term and specificity screens are reported as unobservable, not as clean',()=>{
  const r=s.observe(input({claims:[claim('blind')]}));
  const c=claimOf(r,'blind');assert.equal(c.specificValues,null);assert.deepEqual([...c.reservedTerms],[]);assert.deepEqual([...c.unobservable],['CLAIM_TEXT_NOT_PROVIDED']);
  assert.equal(r.coverage,'PARTIAL');assert.deepEqual([...r.unobservable],['CLAIM_TEXT_NOT_PROVIDED']);
  assert.equal(flagsOf(r,'blind')[0].severity,'WARN');
});

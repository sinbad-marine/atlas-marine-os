'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {a,NOW,KEYS,TRUST,plain,recordsOf,attestInput,checkInput}=require('./helpers/attest-v0-builders.js');
const R=recordsOf();

test('every record kind can be attested and checked AUTHENTIC; envelope and check are frozen, origin only and carry no authority',()=>{
  assert.deepEqual([...a.KIND_NAMES],['SENTINEL_REPORT','COPILOT_REVIEW','GATEKEEPER_DECISION','PILOT_DECISION','CHAIN_TRANSCRIPT']);
  for(const kind of a.KIND_NAMES){
    const result=a.attest(attestInput(kind,R[kind]));
    assert.equal(result.status,'ATTESTED',kind);assert.equal(result.authority,'NONE');assert.equal(result.grantsAuthority,false);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.envelope),true);
    const e=result.envelope;
    assert.deepEqual(Object.keys(e),[...a.ENVELOPE_FIELDS]);assert.equal(e.version,'sinbad-attestation/0-v1');assert.equal(e.algorithm,'ED25519');assert.equal(e.recordKind,kind);assert.equal(e.recordVersion,R[kind].version);assert.equal(e.taskRef,'task-1');assert.equal(e.issuedAt,NOW-10);assert.equal(e.authority,'NONE');assert.match(e.signature,/^[a-f0-9]{128}$/u);
    const c=a.check(checkInput(plain(e),R[kind],{expected:{recordKind:kind,taskRef:'task-1'}}));
    assert.equal(c.status,'AUTHENTIC',kind);assert.equal(c.authentic,true);assert.equal(c.reasonCode,'AUTHENTIC');assert.equal(c.recordKind,kind);assert.equal(c.recordDigest,e.recordDigest);assert.equal(c.keyId,e.keyId);assert.equal(c.taskRef,'task-1');
    assert.equal(c.authority,'NONE');assert.equal(c.originOnly,true);for(const flag of ['grantsAuthority','approves','executes'])assert.equal(c[flag],false,flag);
    assert.equal(Object.isFrozen(c),true);assert.equal(a.verifyCheck(c),true);assert.match(c.provenance.trustStoreDigest,/^[a-f0-9]{64}$/u);
  }
});

test('the envelope is small and binds the record by digest: it never carries the record, claim text or the key seed',()=>{
  const result=a.attest(attestInput('GATEKEEPER_DECISION',R.GATEKEEPER_DECISION));const text=JSON.stringify(result);
  assert.ok(text.length<1200,`envelope result is ${text.length} chars`);assert.equal(text.includes(KEYS.gate),false);assert.equal(text.includes('ruleResults'),false);assert.equal(text.includes('The state file'),false);
  assert.equal(result.envelope.recordDigest,R.GATEKEEPER_DECISION.decisionDigest);assert.notEqual(result.envelope.payloadDigest,result.envelope.recordDigest);
  assert.equal(JSON.stringify(a.check(checkInput(plain(result.envelope),R.GATEKEEPER_DECISION))).includes(TRUST()[0].publicKeyHex),false);
});

test('attestation and checking are deterministic; derivePublicKey is pure and rejects anything that is not a 32-byte seed',()=>{
  const one=a.attest(attestInput('PILOT_DECISION',R.PILOT_DECISION)),two=a.attest(attestInput('PILOT_DECISION',R.PILOT_DECISION));assert.deepEqual(one,two);
  const c1=a.check(checkInput(plain(one.envelope),R.PILOT_DECISION)),c2=a.check(checkInput(plain(two.envelope),R.PILOT_DECISION));assert.deepEqual(c1,c2);assert.equal(c1.checkDigest,c2.checkDigest);
  assert.match(a.derivePublicKey(KEYS.pilot),/^[a-f0-9]{64}$/u);assert.equal(a.derivePublicKey(KEYS.pilot),a.derivePublicKey(KEYS.pilot));assert.notEqual(a.derivePublicKey(KEYS.pilot),a.derivePublicKey(KEYS.gate));
  for(const bad of [null,'',KEYS.pilot.toUpperCase(),KEYS.pilot.slice(1),42,{}])assert.equal(a.derivePublicKey(bad),null);
  const edited=plain(c1);edited.status='REJECTED';assert.equal(a.verifyCheck(edited),false);assert.equal(a.verifyCheck(null),false);assert.equal(a.verifyCheck({}),false);
});

test('attest refuses, without throwing, anything that is not an intact record of the declared kind signed by a well-formed signer',()=>{
  const g=R.GATEKEEPER_DECISION;
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[attestInput('GATEKEEPER_DECISION',g,{extra:1}),'INPUT_INVALID'],[{...attestInput('GATEKEEPER_DECISION',g),version:'x'},'INPUT_INVALID'],[attestInput('GATEKEEPER_DECISION',g,{issuedAt:'0'}),'INPUT_INVALID'],[attestInput('GATEKEEPER_DECISION',g,{recordKind:'ANSWER'}),'INPUT_INVALID'],
    [attestInput('GATEKEEPER_DECISION',g,{signer:{keyId:'key-gate'}}),'SIGNER_INVALID'],[attestInput('GATEKEEPER_DECISION',g,{signer:{keyId:'key-gate',seedHex:'short'}}),'SIGNER_INVALID'],[attestInput('GATEKEEPER_DECISION',g,{signer:null}),'SIGNER_INVALID'],
    [attestInput('GATEKEEPER_DECISION',null),'RECORD_NOT_PLAIN_DATA'],[attestInput('GATEKEEPER_DECISION',[]),'RECORD_NOT_PLAIN_DATA'],[attestInput('GATEKEEPER_DECISION','text'),'RECORD_NOT_PLAIN_DATA'],
    [attestInput('PILOT_DECISION',g),'RECORD_KIND_MISMATCH'],[attestInput('GATEKEEPER_DECISION',R.COPILOT_REVIEW),'RECORD_KIND_MISMATCH'],
    [attestInput('GATEKEEPER_DECISION',{...g,outcome:'BLOCK'}),'RECORD_NOT_INTACT'],[attestInput('GATEKEEPER_DECISION',{version:g.version}),'RECORD_NOT_INTACT']
  ]){const r=a.attest(bad);assert.equal(r.status,'REFUSED',reason);assert.equal(r.reasonCode,reason);assert.equal(r.envelope,null);assert.equal(r.grantsAuthority,false);}
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const cyclic=plain(g);cyclic.self=cyclic;
  for(const hostile of [throwing,new Proxy({},{ownKeys(){throw new Error('boom');}}),Symbol('x'),42,attestInput('GATEKEEPER_DECISION',cyclic)]){let r;assert.doesNotThrow(()=>{r=a.attest(hostile);});assert.equal(r.status,'REFUSED');}
});

test('check input admission is exact: invalid input, policy, expectation, trust store or envelope is REJECTED with the reason',()=>{
  const e=plain(a.attest(attestInput('GATEKEEPER_DECISION',R.GATEKEEPER_DECISION)).envelope);const g=R.GATEKEEPER_DECISION;const store=TRUST();
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[checkInput(e,g,{extra:1}),'INPUT_INVALID'],[{...checkInput(e,g),version:'x'},'INPUT_INVALID'],[checkInput(e,g,{at:'0'}),'INPUT_INVALID'],[checkInput(e,g,{checkId:''}),'INPUT_INVALID'],
    [checkInput(e,g,{policy:{}}),'POLICY_INVALID'],[checkInput(e,g,{policy:{maxAgeMs:0}}),'POLICY_INVALID'],
    [checkInput(e,g,{expected:{}}),'EXPECTATION_INVALID'],[checkInput(e,g,{expected:{recordKind:'ANSWER',taskRef:null}}),'EXPECTATION_INVALID'],
    [checkInput(e,g,{trustStore:{}}),'TRUST_STORE_INVALID'],[checkInput(e,g,{trustStore:[...store,store[0]]}),'TRUST_STORE_INVALID'],[checkInput(e,g,{trustStore:[{...store[0],kinds:[]}]}),'TRUST_STORE_INVALID'],[checkInput(e,g,{trustStore:[{...store[0],kinds:['ANSWER']}]}),'TRUST_STORE_INVALID'],
    [checkInput(e,g,{trustStore:[{...store[0],publicKeyHex:'zz'}]}),'TRUST_STORE_INVALID'],[checkInput(e,g,{trustStore:[{...store[0],notAfter:store[0].notBefore}]}),'TRUST_STORE_INVALID'],[checkInput(e,g,{trustStore:[{...store[0],revoked:'no'}]}),'TRUST_STORE_INVALID'],
    [checkInput({},g),'ENVELOPE_INVALID'],[checkInput({...e,extra:1},g),'ENVELOPE_INVALID'],[checkInput({...e,algorithm:'HMAC'},g),'ENVELOPE_INVALID'],[checkInput({...e,authority:'OWNER'},g),'ENVELOPE_INVALID'],[checkInput({...e,signature:'00'},g),'ENVELOPE_INVALID'],[checkInput({...e,recordVersion:'sinbad-pilot-decision/0-v1'},g),'ENVELOPE_INVALID']
  ]){const c=a.check(bad);assert.equal(c.status,'REJECTED',reason);assert.equal(c.authentic,false);assert.equal(c.reasonCode,reason);assert.equal(a.verifyCheck(c),true,reason);}
});

test('exports are frozen and contain no key generation, key storage, approval, execution, wiring or fetch capability',()=>{
  assert.equal(Object.isFrozen(a),true);
  assert.deepEqual(Object.keys(a),['VERSION','ATTEST_INPUT_VERSION','CHECK_INPUT_VERSION','ENVELOPE_VERSION','RESULT_VERSION','CHECK_VERSION','ALGORITHM','KIND_NAMES','ATTEST_FIELDS','SIGNER_FIELDS','ENVELOPE_FIELDS','CHECK_FIELDS','TRUST_FIELDS','EXPECTED_FIELDS','POLICY_FIELDS','DEFAULT_POLICY','derivePublicKey','envelope','trustStore','policy','attest','check','verifyCheck']);
  assert.deepEqual(a.DEFAULT_POLICY,{maxAgeMs:86_400_000});assert.equal(a.trustStore(new Array(65).fill(TRUST()[0])),null);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const tutor=require('../sinbad-tutor-orchestrator.js');
const professor=require('../sinbad-professor.js');
const catalog=[
  {id:'basics',label:'Temeller',objectives:[{id:'terms',label:'Temel terimleri açıklar'}]},
  {id:'weather',label:'Deniz Havası',prerequisites:['basics'],objectives:[{id:'forecast',label:'Resmî tahmini ayırt eder'},{id:'risk',label:'Hava riskini değerlendirir'}]}
];
const ready=()=>professor.normalizeProfile({mastery:{basics:.8}});

test('creates an immutable deterministic lesson session without storing conversation',()=>{
  const out=tutor.create({sessionId:'lesson-1',profile:ready(),catalog,topicId:'weather'});
  assert.equal(out.action.type,'EXPLAIN');assert.equal(out.session.objectives.length,2);assert.equal(Object.hasOwn(out.session,'messages'),false);assert.ok(Object.isFrozen(out.session));
});
test('blocks unmet prerequisites without changing learner mastery',()=>{
  const out=tutor.create({sessionId:'lesson-2',profile:professor.createProfile(),catalog,topicId:'weather'});
  assert.equal(out.session.reason,'PREREQUISITE_NOT_MET');assert.deepEqual(out.session.details.blockedBy,['basics']);assert.deepEqual(out.profile.mastery,{});
});
test('moves explain to check and requires an explicit assessed result',()=>{
  const first=tutor.create({sessionId:'lesson-3',profile:ready(),catalog,topicId:'weather'});
  const check=tutor.advance(first.session,first.profile,{type:'EXPLANATION_COMPLETE'});
  assert.equal(check.action.type,'ASK_KNOWLEDGE_CHECK');
  const invalid=tutor.advance(check.session,check.profile,{type:'ASSESSMENT',kind:'learner-reflection',score:1,confidence:1});
  assert.equal(invalid.session.reason,'INVALID_ASSESSMENT');assert.equal(Object.hasOwn(invalid.profile.mastery,'weather'),false);
});
test('uses real assessment evidence to remediate or advance objectives',()=>{
  let out=tutor.create({sessionId:'lesson-4',profile:ready(),catalog,topicId:'weather'});
  out=tutor.advance(out.session,out.profile,{type:'EXPLANATION_COMPLETE'});
  out=tutor.advance(out.session,out.profile,{type:'ASSESSMENT',kind:'knowledge-check',score:.4,confidence:1},'2026-08-24T10:00:00.000Z');
  assert.equal(out.action.type,'REMEDIATE');assert.ok(out.profile.mastery.weather>0);
  out=tutor.advance(out.session,out.profile,{type:'REMEDIATION_COMPLETE'});
  out=tutor.advance(out.session,out.profile,{type:'ASSESSMENT',kind:'knowledge-check',score:1,confidence:1},'2026-08-24T10:05:00.000Z');
  assert.equal(out.session.objectiveIndex,1);assert.equal(out.action.type,'EXPLAIN');
});
test('completes only after every objective receives passing evidence',()=>{
  let out=tutor.create({sessionId:'lesson-5',profile:ready(),catalog,topicId:'weather'});
  for(let i=0;i<2;i++){out=tutor.advance(out.session,out.profile,{type:'EXPLANATION_COMPLETE'});out=tutor.advance(out.session,out.profile,{type:'ASSESSMENT',kind:'practice',score:1,confidence:.9},`2026-08-24T10:0${i}:00.000Z`)}
  assert.equal(out.session.status,'COMPLETE');assert.equal(out.action.type,'COMPLETE');assert.equal(out.session.evidence.length,2);
});
test('stops for instructor review after three failed assessed attempts',()=>{
  let out=tutor.create({sessionId:'lesson-6',profile:ready(),catalog,topicId:'weather'});out=tutor.advance(out.session,out.profile,{type:'EXPLANATION_COMPLETE'});
  for(let i=0;i<3;i++){out=tutor.advance(out.session,out.profile,{type:'ASSESSMENT',kind:'practice',score:0,confidence:1});if(i<2)out=tutor.advance(out.session,out.profile,{type:'REMEDIATION_COMPLETE'})}
  assert.equal(out.session.reason,'INSTRUCTOR_REVIEW_REQUIRED');assert.equal(out.action.type,'STOP');
});
test('invalid transitions fail closed and completed sessions cannot be reopened',()=>{
  const first=tutor.create({sessionId:'lesson-7',profile:ready(),catalog,topicId:'weather'});
  const stopped=tutor.advance(first.session,first.profile,{type:'ASSESSMENT',kind:'practice',score:1,confidence:1});
  assert.equal(stopped.session.reason,'INVALID_TRANSITION');
  const again=tutor.advance(stopped.session,stopped.profile,{type:'EXPLANATION_COMPLETE'});assert.deepEqual(again.session,stopped.session);
});
test('catalog rejects duplicate lessons and missing objectives',()=>{
  assert.throws(()=>tutor.create({sessionId:'x',catalog:[{id:'a',objectives:['x']},{id:'a',objectives:['y']}]}),/unique/);
  assert.throws(()=>tutor.create({sessionId:'x',catalog:[{id:'a'}]}),/objective/);
});

test('restores only an active catalog-bound tutor session',()=>{
  let out=tutor.create({sessionId:'resume-1',profile:ready(),catalog,topicId:'weather'});
  out=tutor.advance(out.session,out.profile,{type:'EXPLANATION_COMPLETE'});
  const restored=tutor.restore({catalog,snapshot:{session:JSON.parse(JSON.stringify(out.session)),profile:JSON.parse(JSON.stringify(out.profile))}});
  assert.equal(restored.session.sessionId,'resume-1');
  assert.equal(restored.session.stage,'CHECK');
  assert.equal(restored.action.type,'ASK_KNOWLEDGE_CHECK');
  assert.ok(Object.isFrozen(restored.session));
});

test('rejects altered, stale and completed tutor snapshots',()=>{
  const active=tutor.create({sessionId:'resume-2',profile:ready(),catalog,topicId:'weather'});
  const altered=JSON.parse(JSON.stringify({session:active.session,profile:active.profile}));altered.session.objectives[0].label='forged';
  assert.throws(()=>tutor.restore({catalog,snapshot:altered}),/objectives/);
  const stale=JSON.parse(JSON.stringify({session:active.session,profile:active.profile}));stale.session.version='sinbad-tutor-orchestrator/0';
  assert.throws(()=>tutor.restore({catalog,snapshot:stale}),/identity/);
  let complete=active;
  for(let index=0;index<2;index++){
    complete=tutor.advance(complete.session,complete.profile,{type:'EXPLANATION_COMPLETE'});
    complete=tutor.advance(complete.session,complete.profile,{type:'ASSESSMENT',kind:'knowledge-check',score:1,confidence:1});
  }
  assert.throws(()=>tutor.restore({catalog,snapshot:{session:complete.session,profile:complete.profile}}),/not resumable/);
});

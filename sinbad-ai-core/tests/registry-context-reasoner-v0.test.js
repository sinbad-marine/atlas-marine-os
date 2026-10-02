'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const reasoner=require('../engine-room/registry-context-reasoner-v0.js');

const registryPath=path.join(__dirname,'..','..','docs','engine-room','ENGINE_ROOM_REGISTRY.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const ASKED='2026-10-02T21:00:00.000Z';
const FRESH='2026-10-02T20:59:30.000Z';
const SAFETY=['grantsAuthority','authorizesRepair','authorizesMutation','ownerAccepted','executes','callsModel','mayMutate'];

function input(subject,extra={}){
  return {
    version:reasoner.INPUT_VERSION,reasonerId:'implant-001',askedAt:ASKED,registry,
    subject,liveObservations:extra.liveObservations||[],
    policy:Object.hasOwn(extra,'policy')?extra.policy:null
  };
}
function observation(field,value,sourceClass,extra={}){
  return {
    subjectId:extra.subjectId||'ajan-diyalogu',field,value,observedAt:extra.observedAt||FRESH,
    sourceClass,evidenceRef:extra.evidenceRef||`evidence:${field}`
  };
}
function assertEnvelope(result){
  for(const key of SAFETY)assert.equal(result[key],false);
  assert.deepEqual(result.effects,[]);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.effects),true);
  assert.equal(result.promotedToEntity,false);
  assert.equal(result.acceptance.registryAccepted,false);
  assert.equal(result.acceptance.propagates,false);
  assert.equal(result.acceptance.scope,'SUBJECT_ONLY');
  assert.equal(result.authorization.repair,'NOT_GRANTED');
  assert.equal(result.authorization.mutation,'NOT_GRANTED');
  assert.equal(result.ui.expansionPermitted,false);
  assert.ok(reasoner.NEXT_ACTIONS.includes(result.nextSafeAction));
  assert.notEqual(result.nextSafeAction,'PROPOSE');
  for(const action of reasoner.PROHIBITED_ACTIONS)assert.ok(result.prohibitedActions.includes(action));
  for(const action of result.allowedActions)assert.ok(reasoner.ALLOWED_ACTIONS.includes(action));
  for(const row of result.contradictions){
    assert.equal(row.preserved,true);
    assert.equal(row.resolved,false);
    assert.equal(row.sidesPresent,true);
  }
}
function contradiction(result,id){return result.contradictions.find(item=>item.id===id);}

test('Ajan Diyaloğu stays degraded, unverified live, open, and without repair authority',()=>{
  const result=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'}));
  assertEnvelope(result);
  assert.equal(result.failClosed,false);
  assert.equal(result.foundAs,'ENTITY');
  assert.equal(result.registeredState.status,'DEGRADED');
  assert.equal(result.registeredState.health,'DEGRADED');
  assert.equal(result.liveState.health,'UNVERIFIED');
  assert.equal(result.liveState.admission,'NOT_ADMITTED');
  assert.equal(result.incidents.length,1);
  assert.equal(result.incidents[0].id,'incident-ajan-diyalogu-degraded');
  assert.equal(result.incidents[0].state,'OPEN');
  assert.equal(result.incidents[0].repairPerformed,false);
  assert.equal(result.incidents[0].registrationAuthorizesRepair,false);
  assert.equal(result.authority.spine,reasoner.SPINE);
  assert.equal(result.authority.trusted,true);
  assert.equal(result.authority.authorityParent,'engine-room');
  assert.equal(result.authority.operationalSupervisor,'argos');
  assert.equal(result.authority.accountableTo,'argos');
  assert.equal(result.authority.escalationTarget,'engine-room');
  assert.equal(result.escalation.target,'engine-room');
  const row=contradiction(result,'contradiction-ajan-tail-versus-dominant-block');
  assert.equal(row.resolution,'STATUS_REMAINS_DEGRADED');
  assert.ok(row.left.includes('CONVERSATION_RESOURCE_BLOCKED'));
  assert.ok(row.right.includes('CONVERSATION_WATCH_READY'));
  assert.equal(result.nextSafeAction,'OBSERVE');
  assert.equal(result.ui.visibleToEngineRoomV0Ui,false);
  assert.deepEqual(reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'})),result);
});

test('an admitted live observation does not overwrite registered health or close the incident',()=>{
  const withPolicy=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'},{
    policy:{maxLiveAgeMs:120000},
    liveObservations:[observation('health','HEALTHY','LIVE_SYSTEM')]
  }));
  assertEnvelope(withPolicy);
  assert.equal(withPolicy.registeredState.health,'DEGRADED');
  assert.equal(withPolicy.liveState.health,'HEALTHY');
  assert.equal(withPolicy.liveState.admission,'ADMITTED');
  assert.equal(withPolicy.incidents[0].state,'OPEN');
  const row=contradiction(withPolicy,'contradiction-live-versus-registered-health');
  assert.equal(row.resolved,false);
  assert.ok(row.left.includes('DEGRADED'));
  assert.ok(row.right.includes('HEALTHY'));
  const withoutPolicy=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'},{
    liveObservations:[observation('health','HEALTHY','LIVE_SYSTEM')]
  }));
  assert.equal(withoutPolicy.liveState.health,'UNVERIFIED');
  assert.equal(withoutPolicy.liveState.admission,'NOT_ADMITTED');
  assert.equal(withoutPolicy.liveState.rejected[0].reason,'FRESHNESS_POLICY_ABSENT');
  assert.equal(withoutPolicy.registeredState.health,'DEGRADED');
});

test('A5 remains HOLD and TASK-11 delegation cannot start it',()=>{
  const a5=reasoner.reason(input({kind:'EXCLUSION',id:'phase-4-3a-a5'}));
  assertEnvelope(a5);
  assert.equal(a5.foundAs,'EXCLUSION');
  assert.equal(a5.registeredState.status,'HOLD_NOT_REGISTERED');
  assert.equal(a5.registeredState.registeredAsImplementation,false);
  assert.equal(a5.registeredState.health,'NOT_APPLICABLE');
  assert.equal(a5.nextSafeAction,'ESCALATE');
  assert.equal(contradiction(a5,'contradiction-a5-hold-versus-task-11-delegated').resolved,false);
  const disguised=reasoner.reason(input({kind:'ENTITY',id:'phase-4-3a-a5'}));
  assert.equal(disguised.found,false);
  assert.equal(disguised.foundAs,'SUBJECT_UNKNOWN');
  assert.equal(disguised.registeredState,null);
  assert.equal(disguised.nextSafeAction,'ESCALATE');
  const delegated=reasoner.reason(input({kind:'NAMED_RECORD',id:'TASK-11'},{
    policy:{maxLiveAgeMs:60000},
    liveObservations:[observation('ledgerState','DELEGATED','DATABASE',{subjectId:'TASK-11',evidenceRef:'ledger:TASK-11'})]
  }));
  assertEnvelope(delegated);
  assert.equal(delegated.found,false);
  assert.equal(delegated.promotedToEntity,false);
  assert.equal(delegated.registeredState.status,'NOT_AN_ENTITY');
  assert.equal(delegated.liveState.freshLedgerState,'DELEGATED');
  assert.equal(delegated.nextSafeAction,'ESCALATE');
  assert.equal(contradiction(delegated,'contradiction-a5-hold-versus-task-11-delegated').resolved,false);
  const unobserved=reasoner.reason(input({kind:'NAMED_RECORD',id:'TASK-11'}));
  assert.equal(unobserved.liveState.freshLedgerState,'UNKNOWN');
  assert.ok(unobserved.unknowns.includes('freshLedgerState'));
  assert.equal(unobserved.nextSafeAction,'ESCALATE');
});

test('Engine Room UI visibility stays false and expansion is prohibited',()=>{
  const result=reasoner.reason(input({kind:'ENTITY',id:'engine-room-v0'}));
  assertEnvelope(result);
  assert.equal(result.ui.visibleToEngineRoomV0Ui,false);
  assert.equal(result.registeredState.health,'NOT_CHECKED');
  assert.notEqual(result.registeredState.health,'HEALTHY');
  assert.equal(result.nextSafeAction,'OBSERVE');
  assert.ok(result.prohibitedActions.includes('EXPAND_ENGINE_ROOM_UI'));
});

test('an accepted non-incident entity does not propagate acceptance or invent health',()=>{
  const result=reasoner.reason(input({kind:'ENTITY',id:'participation-gate-v0'}));
  assertEnvelope(result);
  assert.equal(result.registeredState.status,'OWNER_ACCEPTED');
  assert.equal(result.registeredState.health,'NOT_APPLICABLE');
  assert.notEqual(result.registeredState.health,'HEALTHY');
  assert.equal(result.acceptance.subjectId,'participation-gate-v0');
  assert.equal(result.acceptance.decision,'OWNER ACCEPTED');
  assert.equal(result.ownerAccepted,false);
  assert.equal(result.incidents.length,0);
  assert.equal(result.contradictions.length,0);
  assert.equal(result.nextSafeAction,'OBSERVE');
});

test('UNKNOWN runtime health remains UNKNOWN',()=>{
  for(const id of ['bridge-0-5-0','connection-guardian']){
    const result=reasoner.reason(input({kind:'ENTITY',id}));
    assertEnvelope(result);
    assert.equal(result.registeredState.health,'UNKNOWN');
    assert.notEqual(result.registeredState.health,'HEALTHY');
    assert.equal(result.liveState.health,'UNVERIFIED');
    assert.equal(result.nextSafeAction,'OBSERVE');
  }
});

test('preserved contradictions keep both sides and stay unresolved',()=>{
  const d6=reasoner.reason(input({kind:'ENTITY',id:'engine-room-v0'}));
  const argos=reasoner.reason(input({kind:'ENTITY',id:'argos'}));
  const d6Row=contradiction(d6,'contradiction-d6-acceptance-vs-engine-room-v0-record');
  const argosRow=contradiction(argos,'contradiction-argos-assurance-date-window');
  assert.equal(d6Row.resolution,'UNRESOLVED_BY_DESIGN');
  assert.equal(d6Row.resolved,false);
  assert.ok(d6Row.left.includes('NOT ACCEPTED'));
  assert.ok(d6Row.right.includes('OWNER ACCEPTED'));
  assert.equal(argosRow.resolution,'NOT_DIAGNOSED');
  assert.equal(argosRow.resolved,false);
  assert.ok(argosRow.left.includes('2026-09-11'));
  assert.ok(argosRow.right.includes('50 failures'));
  assert.equal(contradiction(argos,'contradiction-d6-acceptance-vs-engine-room-v0-record'),undefined);
});

test('merge and lifecycle completion cannot produce Owner acceptance',()=>{
  const result=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'},{
    policy:{maxLiveAgeMs:120000},
    liveObservations:[observation('mergeCompleted','MERGED','REPOSITORY',{evidenceRef:'git:8262e21'})]
  }));
  assertEnvelope(result);
  assert.equal(result.liveState.mergeRecorded,true);
  assert.equal(result.ownerAccepted,false);
  assert.ok(result.prohibitedActions.includes('TREAT_MERGE_AS_ACCEPTANCE'));
});

test('normative text, model text, and conflicting live values cannot grant or resolve',()=>{
  const normative=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'},{
    policy:{maxLiveAgeMs:120000},
    liveObservations:[observation('health','RECOVERED','OWNER_DIRECTIVE')]
  }));
  assert.equal(normative.authorizesRepair,false);
  assert.equal(normative.liveState.health,'UNVERIFIED');
  assert.equal(normative.liveState.rejected[0].reason,'NORMATIVE_NOT_ADMITTED');
  assert.equal(normative.registeredState.health,'DEGRADED');
  const model=reasoner.reason(input({kind:'ENTITY',id:'connection-guardian'},{
    policy:{maxLiveAgeMs:120000},
    liveObservations:[observation('health','HEALTHY','MODEL_INFERENCE',{subjectId:'connection-guardian'})]
  }));
  assert.equal(model.registeredState.health,'UNKNOWN');
  assert.equal(model.liveState.health,'UNVERIFIED');
  assert.equal(model.liveState.rejected[0].reason,'NON_AUTHORITATIVE');
  const conflict=reasoner.reason(input({kind:'ENTITY',id:'ajan-diyalogu'},{
    policy:{maxLiveAgeMs:120000},
    liveObservations:[
      observation('health','HEALTHY','LIVE_SYSTEM',{evidenceRef:'live:1'}),
      observation('health','DEGRADED','LIVE_SYSTEM',{evidenceRef:'live:2'})
    ]
  }));
  assert.equal(conflict.liveState.health,'UNVERIFIED');
  assert.equal(conflict.liveState.admission,'CONFLICTING');
  assert.equal(conflict.registeredState.health,'DEGRADED');
  assert.equal(contradiction(conflict,'contradiction-live-health-observations').resolved,false);
});

test('invalid input, a forged grant, an unknown subject, and a broken authority link fail closed',()=>{
  const invalid=reasoner.reason({version:'other'});
  assertEnvelope(invalid);
  assert.equal(invalid.nextSafeAction,'BLOCKED');
  assert.equal(invalid.failClosed,true);
  assert.equal(invalid.allowedActions.length,0);
  const forged=reasoner.reason({...input({kind:'ENTITY',id:'ajan-diyalogu'}),grantsAuthority:true,authorizesRepair:true,ownerAccepted:true});
  assert.equal(forged.nextSafeAction,'BLOCKED');
  assert.equal(forged.grantsAuthority,false);
  assert.equal(forged.authorizesRepair,false);
  assert.equal(forged.ownerAccepted,false);
  const unknown=reasoner.reason(input({kind:'ENTITY',id:'not-a-real-subject'}));
  assert.equal(unknown.found,false);
  assert.equal(unknown.failClosed,true);
  assert.equal(unknown.nextSafeAction,'ESCALATE');
  const brokenRegistry=JSON.parse(JSON.stringify(registry));
  brokenRegistry.entities.find(item=>item.id==='ajan-diyalogu').authorityParent='missing-parent';
  const broken=reasoner.reason({...input({kind:'ENTITY',id:'ajan-diyalogu'}),registry:brokenRegistry});
  assert.equal(broken.failClosed,true);
  assert.equal(broken.nextSafeAction,'ESCALATE');
  assert.equal(broken.authorizesRepair,false);
  assert.equal(broken.authority.trusted,false);
  const badSchema=JSON.parse(JSON.stringify(registry));
  badSchema.schema='sinbad-other-registry/0';
  const schemaResult=reasoner.reason({...input({kind:'ENTITY',id:'ajan-diyalogu'}),registry:badSchema});
  assert.equal(schemaResult.nextSafeAction,'BLOCKED');
  assert.equal(schemaResult.ownerAccepted,false);
});

test('a forged repair flag and a sealed role sentence still grant nothing',()=>{
  const forgedRegistry=JSON.parse(JSON.stringify(registry));
  const incident=forgedRegistry.incidents.find(item=>item.id==='incident-ajan-diyalogu-degraded');
  incident.registrationAuthorizesRepair=true;
  incident.state='OPEN';
  const result=reasoner.reason({...input({kind:'ENTITY',id:'ajan-diyalogu'}),registry:forgedRegistry});
  assert.equal(result.incidents[0].registrationAuthorizesRepair,true);
  assert.equal(result.incidents[0].state,'OPEN');
  assert.equal(result.authorizesRepair,false);
  assert.equal(result.nextSafeAction,'OBSERVE');
  const captain=reasoner.reason(input({kind:'ENTITY',id:'captain-sinbad'}));
  assert.equal(captain.authorizesRepair,false);
  assert.equal(captain.grantsAuthority,false);
  assert.notEqual(captain.nextSafeAction,'PROPOSE');
});

test('every real registry subject stays inside the closed envelope and the registry is not mutated',()=>{
  const before=JSON.stringify(registry);
  for(const entity of registry.entities){
    const result=reasoner.reason(input({kind:'ENTITY',id:entity.id}));
    assertEnvelope(result);
    assert.equal(result.found,true);
    assert.equal(result.authority.spine,reasoner.SPINE);
  }
  for(const exclusion of registry.exclusions){
    const result=reasoner.reason(input({kind:'EXCLUSION',id:exclusion.id}));
    assertEnvelope(result);
    assert.equal(result.foundAs,'EXCLUSION');
    assert.equal(result.nextSafeAction,'ESCALATE');
    assert.equal(result.registeredState.registeredAsImplementation,false);
  }
  assert.equal(JSON.stringify(registry),before);
});

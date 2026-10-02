'use strict';
// Registry Context Reasoner v0. Pure and fail-closed.
// It answers one registry subject. It does not observe a live process, write a ledger,
// grant authority, authorize repair, accept anything for the Owner, or call a model.
const crypto=require('node:crypto');
const authorityModel=require('../authority/authority-model');

const VERSION='sinbad-registry-context-reasoner/0';
const INPUT_VERSION='sinbad-registry-context-reasoner-input/0';
const RESULT_VERSION='sinbad-registry-context-result/0';
const REGISTRY_SCHEMA='sinbad-engine-room-registry/0';
const SPINE='OWNER_POLICY > CAPTAIN_SINBAD > ARGOS > ENGINE_ROOM_OPERATIONAL_MANAGEMENT > SUBORDINATE_SYSTEMS';
const INPUT_KEYS=Object.freeze(['version','reasonerId','askedAt','registry','subject','liveObservations','policy']);
const SUBJECT_KEYS=Object.freeze(['kind','id']);
const POLICY_KEYS=Object.freeze(['maxLiveAgeMs']);
const OBSERVATION_KEYS=Object.freeze(['subjectId','field','value','observedAt','sourceClass','evidenceRef']);
const KINDS=Object.freeze(['ENTITY','EXCLUSION','NAMED_RECORD']);
const OBSERVATION_FIELDS=Object.freeze(['health','ledgerState','mergeCompleted']);
const ALLOWED_ACTIONS=Object.freeze(['OBSERVE','DIAGNOSE','PROPOSE','ESCALATE']);
const LIMITED_ACTIONS=Object.freeze(['OBSERVE','ESCALATE']);
const PROHIBITED_ACTIONS=Object.freeze(['REPAIR','MUTATE','APPLY','START_A5','START_A6','CLOSE_INCIDENT','RESOLVE_CONTRADICTION','PROMOTE_UNKNOWN','TREAT_MERGE_AS_ACCEPTANCE','EXPAND_ENGINE_ROOM_UI','GRANT_AUTHORITY']);
const NEXT_ACTIONS=Object.freeze(['OBSERVE','ESCALATE','BLOCKED']);
const EMPTY=Object.freeze([]);
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const ID=/^[A-Za-z0-9._-]{1,80}$/u;
const MAX_LIVE_AGE_MS=366*24*60*60*1000;
const MAX_OBSERVATIONS=16;
const GENERIC_SEGMENTS=Object.freeze(new Set(['acceptance','atlas','channel','closure','engine','gate','guardian','health','hold','layer','marine','model','owner','phase','plane','prototype','record','review','room','sinbad','state','status','system','task','versus']));

const isPlain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function exactKeys(value,names){
  if(!isPlain(value)||Object.getOwnPropertySymbols(value).length)return false;
  const keys=Object.getOwnPropertyNames(value);
  return keys.length===names.length&&names.every(name=>keys.includes(name));
}
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256=value=>crypto.createHash('sha256').update(canonical(value),'utf8').digest('hex');
function freezeDeep(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const item of Object.values(value))freezeDeep(item);
  return Object.freeze(value);
}
const stampOk=value=>typeof value==='string'&&ISO.test(value)&&Number.isFinite(Date.parse(value));
function ageMs(askedAt,observedAt){
  if(!stampOk(askedAt)||!stampOk(observedAt))return null;
  const age=Date.parse(askedAt)-Date.parse(observedAt);
  return age>=0?age:null;
}
function segments(id){return String(id).toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);}
function distinctive(segment){
  if(GENERIC_SEGMENTS.has(segment)||/^v\d+$/u.test(segment))return false;
  return segment.length>=4||/^a\d+$/u.test(segment)||/^[a-z]\d+$/u.test(segment)||/^\d{2,}$/u.test(segment);
}
function touches(subjectId,contradiction){
  const cid=typeof contradiction.id==='string'?contradiction.id.toLowerCase():'';
  const sid=subjectId.toLowerCase();
  if(!cid)return false;
  if(cid.includes(sid))return true;
  const wanted=new Set(segments(cid).filter(distinctive));
  return segments(sid).some(segment=>distinctive(segment)&&wanted.has(segment));
}
function knownRef(value,byId){return value==='NONE'||(typeof value==='string'&&byId.has(value));}
function nodeIntact(entity,byId){
  if(!entity||typeof entity.id!=='string'||entity.authorityParent===entity.id||entity.parentId===entity.id)return false;
  if(!knownRef(entity.authorityParent,byId)||!knownRef(entity.parentId,byId)||!knownRef(entity.escalationTarget,byId))return false;
  if(!knownRef(entity.operationalSupervisor,byId)||!knownRef(entity.accountableTo,byId))return false;
  if(typeof entity.policySource!=='string'||!entity.policySource.startsWith('OWNER_POLICY'))return false;
  if(typeof entity.delegatedAuthority!=='string'||entity.delegatedAuthority.length<1)return false;
  if(typeof entity.authorizationRequired!=='boolean')return false;
  if(entity.failClosedBehavior==='FAIL_CLOSED_NO_UPWARD_AUTHORITY')return entity.authorityParent==='NONE'&&entity.parentId==='NONE'&&entity.escalationTarget==='NONE';
  if(entity.failClosedBehavior==='FAIL_CLOSED_ESCALATE_UPWARD')return entity.authorityParent!=='NONE'&&entity.escalationTarget!=='NONE';
  return false;
}
function chainIntact(entity,byId){
  const seen=new Set();
  let current=entity;
  for(let hop=0;hop<12;hop+=1){
    if(!current||seen.has(current.id)||!nodeIntact(current,byId))return false;
    seen.add(current.id);
    if(current.authorityParent==='NONE')return true;
    current=byId.get(current.authorityParent);
  }
  return false;
}
function indexById(items){
  const byId=new Map();
  for(const item of items){
    if(!isPlain(item)||typeof item.id!=='string'||!ID.test(item.id)||byId.has(item.id))return null;
    byId.set(item.id,item);
  }
  return byId;
}
function registryView(registry){
  if(!isPlain(registry)||registry.schema!==REGISTRY_SCHEMA||registry.canonicalAuthority!==SPINE)return null;
  if(typeof registry.registryId!=='string'||!ID.test(registry.registryId))return null;
  if(!Array.isArray(registry.entities)||!Array.isArray(registry.exclusions)||!Array.isArray(registry.contradictions)||!Array.isArray(registry.incidents))return null;
  if(typeof registry.visibleToEngineRoomV0Ui!=='boolean')return null;
  if(registry.recordingDoesNotAcceptTheRegistry!==true||registry.registrationIsNotRepairAuthorization!==true||registry.registrationIsNotAnAuthorityGrant!==true)return null;
  if(!Array.isArray(registry.doesNotAuthorize)||registry.doesNotAuthorize.some(item=>typeof item!=='string'))return null;
  const entities=indexById(registry.entities);
  const exclusions=indexById(registry.exclusions);
  if(!entities||!exclusions)return null;
  if(registry.contradictions.some(item=>!isPlain(item)||typeof item.id!=='string')||registry.incidents.some(item=>!isPlain(item)||typeof item.id!=='string'))return null;
  return {registry,entities,exclusions,sha256:sha256(registry)};
}
function policyView(policy){
  if(policy===null)return {ok:true,max:null};
  if(!exactKeys(policy,POLICY_KEYS)||!Number.isSafeInteger(policy.maxLiveAgeMs)||policy.maxLiveAgeMs<1||policy.maxLiveAgeMs>MAX_LIVE_AGE_MS)return {ok:false,max:null};
  return {ok:true,max:policy.maxLiveAgeMs};
}
function observationList(input){
  if(!Array.isArray(input.liveObservations)||input.liveObservations.length>MAX_OBSERVATIONS)return null;
  const out=[];
  for(const item of input.liveObservations){
    if(!exactKeys(item,OBSERVATION_KEYS)||!ID.test(item.subjectId)||!OBSERVATION_FIELDS.includes(item.field))return null;
    if(typeof item.value!=='string'||item.value.length<1||item.value.length>200)return null;
    if(!stampOk(item.observedAt)||typeof item.sourceClass!=='string'||typeof item.evidenceRef!=='string'||item.evidenceRef.length<1||item.evidenceRef.length>300)return null;
    out.push(item);
  }
  return out;
}
function inputView(input){
  if(!exactKeys(input,INPUT_KEYS)||input.version!==INPUT_VERSION||typeof input.reasonerId!=='string'||!ID.test(input.reasonerId))return null;
  if(!stampOk(input.askedAt)||!exactKeys(input.subject,SUBJECT_KEYS)||!KINDS.includes(input.subject.kind)||!ID.test(input.subject.id))return null;
  const observations=observationList(input);
  const policy=policyView(input.policy);
  if(!observations||!policy.ok)return null;
  return {input,observations,policy,digest:sha256(input)};
}
function safety(){
  return {
    grantsAuthority:false,authorizesRepair:false,authorizesMutation:false,ownerAccepted:false,
    executes:false,callsModel:false,mayMutate:false,effects:EMPTY
  };
}
function authorization(){return {repair:'NOT_GRANTED',mutation:'NOT_GRANTED',reason:'NO_GRANT_INPUT'};}
function uiOf(view){return {visibleToEngineRoomV0Ui:view?view.registry.visibleToEngineRoomV0Ui:null,expansionPermitted:false};}
function base(view,parsed,extra){
  return {
    version:RESULT_VERSION,reasonerVersion:VERSION,inputDigest:parsed?parsed.digest:null,
    registrySha256:view?view.sha256:null,failClosed:true,status:'BLOCKED',found:false,foundAs:'SUBJECT_UNKNOWN',
    promotedToEntity:false,subject:parsed?{kind:parsed.input.subject.kind,id:parsed.input.subject.id}:null,
    registeredState:null,liveState:{health:'UNVERIFIED',admission:'NOT_ADMITTED',freshLedgerState:'UNKNOWN',mergeRecorded:false},
    evidence:EMPTY,provenance:null,authority:null,authorization:authorization(),contradictions:EMPTY,incidents:EMPTY,
    unknowns:Object.freeze(['INPUT']),allowedActions:EMPTY,prohibitedActions:PROHIBITED_ACTIONS,
    escalation:{target:'OWNER_POLICY',behavior:'FAIL_CLOSED_ESCALATE_UPWARD'},nextSafeAction:'BLOCKED',
    acceptance:{subjectId:parsed?parsed.input.subject.id:null,decision:'UNKNOWN',scope:'SUBJECT_ONLY',registryAccepted:false,propagates:false},
    ui:uiOf(view),...extra,...safety()
  };
}
function blocked(view,parsed){return freezeDeep(base(view,parsed,{}));}
function contradictionView(item,synthetic){
  return {
    id:item.id,state:typeof item.state==='string'?item.state:'PRESERVED',
    left:Object.hasOwn(item,'left')?item.left:null,right:Object.hasOwn(item,'right')?item.right:null,
    resolution:typeof item.resolution==='string'?item.resolution:'UNRESOLVED_BY_DESIGN',
    preserved:true,resolved:false,synthetic:synthetic===true,
    sidesPresent:typeof item.left==='string'&&item.left.length>0&&typeof item.right==='string'&&item.right.length>0
  };
}
function relatedContradictions(view,subjectId){
  return view.registry.contradictions.filter(item=>touches(subjectId,item)).map(item=>contradictionView(item,false));
}
function admitObservations(parsed,subjectId){
  const admitted=[],rejected=[];
  for(const item of parsed.observations){
    if(item.subjectId!==subjectId){rejected.push({field:item.field,reason:'SUBJECT_MISMATCH'});continue;}
    const described=authorityModel.describe(item.sourceClass);
    if(!described||described.dimension==='NONE'){rejected.push({field:item.field,reason:'NON_AUTHORITATIVE'});continue;}
    if(described.canAuthorize||described.dimension==='NORMATIVE'){rejected.push({field:item.field,reason:'NORMATIVE_NOT_ADMITTED'});continue;}
    const wants=item.field==='health'?'LIVE_SYSTEM':item.field==='ledgerState'?'DATABASE':'REPOSITORY';
    if(item.sourceClass!==wants){rejected.push({field:item.field,reason:'SOURCE_CLASS_NOT_ELIGIBLE'});continue;}
    if(parsed.policy.max===null){rejected.push({field:item.field,reason:'FRESHNESS_POLICY_ABSENT'});continue;}
    const age=ageMs(parsed.input.askedAt,item.observedAt);
    if(age===null||age>parsed.policy.max){rejected.push({field:item.field,reason:'NOT_FRESH'});continue;}
    admitted.push({field:item.field,value:item.value,sourceClass:item.sourceClass,observedAt:item.observedAt,evidenceRef:item.evidenceRef});
  }
  return {admitted,rejected};
}
function liveStateFrom(admission,registeredHealth){
  const healths=admission.admitted.filter(item=>item.field==='health');
  const ledgers=admission.admitted.filter(item=>item.field==='ledgerState');
  const merges=admission.admitted.filter(item=>item.field==='mergeCompleted');
  let health='UNVERIFIED',admissionState='NOT_ADMITTED',synthetic=null;
  if(healths.length===1){
    health=healths[0].value;admissionState='ADMITTED';
    if(health!==registeredHealth)synthetic=contradictionView({id:'contradiction-live-versus-registered-health',state:'PRESERVED',left:`registered health ${registeredHealth}`,right:`live health ${health}`,resolution:'UNRESOLVED_BY_DESIGN'},true);
  }else if(healths.length>1){
    admissionState='CONFLICTING';
    synthetic=contradictionView({id:'contradiction-live-health-observations',state:'PRESERVED',left:healths[0].value,right:healths[1].value,resolution:'UNRESOLVED_BY_DESIGN'},true);
  }
  return {
    health,admission:admissionState,
    freshLedgerState:ledgers.length===1?ledgers[0].value:'UNKNOWN',
    mergeRecorded:merges.length>0,
    admitted:healths.length+ledgers.length+merges.length?Object.freeze(admission.admitted):EMPTY,
    rejected:admission.rejected.length?Object.freeze(admission.rejected):EMPTY,
    synthetic
  };
}
function incidentViews(view,entity){
  const ids=new Set(Array.isArray(entity.incidents)?entity.incidents.filter(id=>typeof id==='string'):[]);
  return view.registry.incidents.filter(item=>ids.has(item.id)||item.componentId===entity.id).map(item=>({
    id:item.id,state:typeof item.state==='string'?item.state:'UNKNOWN',
    health:typeof item.health==='string'?item.health:'UNKNOWN',
    repairPerformed:item.repairPerformed===true,
    registrationAuthorizesRepair:item.registrationAuthorizesRepair===true
  }));
}
function authorityView(entity,trusted){
  if(!entity)return {spine:trusted?SPINE:null,trusted:false,authorityParent:null,structuralParent:null,operationalSupervisor:null,accountableTo:null,escalationTarget:null,policySource:null};
  return {
    spine:SPINE,trusted,authorityParent:entity.authorityParent,structuralParent:entity.parentId,
    operationalSupervisor:entity.operationalSupervisor,accountableTo:entity.accountableTo,
    escalationTarget:entity.escalationTarget,policySource:entity.policySource
  };
}
function withUnknown(list,name){
  const out=Array.isArray(list)?list.filter(item=>typeof item==='string'):[];
  if(!out.includes(name))out.push(name);
  return Object.freeze(out);
}
function evidenceFor(subjectId,rows){
  return Object.freeze([{source:'REGISTRY_DOCUMENT',locator:`subject:${subjectId}`,value:subjectId},...rows]);
}
function reason(input){
  const parsed=inputView(input);
  if(!parsed)return blocked(null,null);
  const view=registryView(parsed.input.registry);
  if(!view)return blocked(null,parsed);
  const subject=parsed.input.subject;
  const contradictions=relatedContradictions(view,subject.id);
  const entity=subject.kind==='ENTITY'?view.entities.get(subject.id)||null:null;
  const exclusion=subject.kind==='EXCLUSION'?view.exclusions.get(subject.id)||null:null;
  const named=subject.kind==='NAMED_RECORD';
  const found=Boolean(entity||exclusion);
  const intact=entity?chainIntact(entity,view.entities):false;
  const registeredHealth=entity&&typeof entity.health==='string'?entity.health:exclusion?'NOT_APPLICABLE':'NOT_APPLICABLE';
  const live=liveStateFrom(admitObservations(parsed,subject.id),registeredHealth);
  const contradictionRows=Object.freeze(live.synthetic?[...contradictions,live.synthetic]:contradictions);
  const incidents=entity?Object.freeze(incidentViews(view,entity)):EMPTY;
  const unknownSeed=entity&&Array.isArray(entity.unknownFields)?entity.unknownFields:[];
  let unknowns=unknownSeed;
  if(live.admission!=='ADMITTED')unknowns=withUnknown(unknowns,'liveHealth');
  if(named&&live.freshLedgerState==='UNKNOWN')unknowns=withUnknown(unknowns,'freshLedgerState');
  const provenance={
    registrySchema:REGISTRY_SCHEMA,registryId:view.registry.registryId,registrySha256:view.sha256,subjectId:subject.id,
    fieldPaths:Object.freeze(entity?[`entities/${entity.id}/health`,`entities/${entity.id}/authorityParent`]:exclusion?[`exclusions/${exclusion.id}/classification`]:['contradictions'])
  };
  let next='OBSERVE',failClosed=false,status='SEALED',allowed=ALLOWED_ACTIONS,foundAs=entity?'ENTITY':exclusion?'EXCLUSION':'SUBJECT_UNKNOWN';
  if(named)foundAs=contradictions.length?'NAMED_RECORD':'SUBJECT_UNKNOWN';
  if(!found&&!named){next='ESCALATE';failClosed=true;status='FAIL_CLOSED';allowed=LIMITED_ACTIONS;}
  else if(named&&contradictions.length===0){next='ESCALATE';failClosed=true;status='FAIL_CLOSED';allowed=LIMITED_ACTIONS;foundAs='SUBJECT_UNKNOWN';}
  else if(entity&&!intact){next='ESCALATE';failClosed=true;status='FAIL_CLOSED';allowed=LIMITED_ACTIONS;}
  else if(exclusion&&exclusion.registeredAsImplementation===true){next='ESCALATE';failClosed=true;status='FAIL_CLOSED';allowed=LIMITED_ACTIONS;}
  else if(exclusion||named)next='ESCALATE';
  const registeredState=entity?{
    status:typeof entity.status==='string'?entity.status:'UNKNOWN',health:registeredHealth,
    acceptance:typeof entity.acceptance==='string'?entity.acceptance:'UNKNOWN',
    acceptanceDecision:typeof entity.acceptanceDecision==='string'?entity.acceptanceDecision:'UNKNOWN'
  }:exclusion?{
    status:typeof exclusion.classification==='string'?exclusion.classification:'UNKNOWN',health:'NOT_APPLICABLE',
    acceptance:'NOT_REGISTERED',acceptanceDecision:'NOT_REGISTERED',registeredAsImplementation:exclusion.registeredAsImplementation===true
  }:named?{status:'NOT_AN_ENTITY',health:'NOT_APPLICABLE',acceptance:'UNKNOWN',acceptanceDecision:'UNKNOWN'}:null;
  const decision=entity?registeredState.acceptanceDecision:exclusion?'NOT_REGISTERED':'UNKNOWN';
  return freezeDeep(base(view,parsed,{
    failClosed,status,found:Boolean(entity||exclusion),foundAs,promotedToEntity:false,
    registeredState,liveState:{health:live.health,admission:live.admission,freshLedgerState:named?live.freshLedgerState:'NOT_APPLICABLE',mergeRecorded:live.mergeRecorded,admitted:live.admitted,rejected:live.rejected},
    evidence:evidenceFor(subject.id,contradictionRows.map(item=>({source:'REGISTRY_DOCUMENT',locator:`contradictions/${item.id}`,value:item.resolution}))),
    provenance,authority:authorityView(entity,Boolean(entity&&intact&&!failClosed)),authorization:authorization(),
    contradictions:contradictionRows,incidents,unknowns:Array.isArray(unknowns)?Object.freeze([...unknowns]):EMPTY,
    allowedActions:allowed,escalation:{target:entity&&intact?entity.escalationTarget:'OWNER_POLICY',behavior:entity&&entity.failClosedBehavior==='FAIL_CLOSED_NO_UPWARD_AUTHORITY'?'FAIL_CLOSED_NO_UPWARD_AUTHORITY':'FAIL_CLOSED_ESCALATE_UPWARD'},
    nextSafeAction:next,
    acceptance:{subjectId:subject.id,decision,scope:'SUBJECT_ONLY',registryAccepted:false,propagates:false}
  }));
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,RESULT_VERSION,SPINE,PROHIBITED_ACTIONS,ALLOWED_ACTIONS,NEXT_ACTIONS,reason});

'use strict';
// EvidenceSet: the identified evidence a task actually had. EvidenceMap: which evidence each claim of
// a draft rests on. verifyMap() is the deterministic provenance check the Phase 2 baseline could not
// perform because the current bridge returns no evidence set.
const {own,id,ref,hash,time,freezeDeep}=require('./exact');
const {isSourceClass,dimension}=require('./authority-model');
const {isolationCheck}=require('./task-context');
const VERSION='sinbad-evidence-set/1-v1';
const MAP_VERSION='sinbad-evidence-map/1-v1';
const ITEM_FIELDS=Object.freeze(['evidenceId','sourceClass','locatorRef','contentHash','observedAt','scopeRef']);
const SET_FIELDS=Object.freeze(['version','setId','taskRef','items','retrievedAt']);
const MAP_FIELDS=Object.freeze(['version','mapId','taskRef','entries']);
const ENTRY_FIELDS=Object.freeze(['claimId','evidenceIds']);
const MAX_ITEMS=256,MAX_ENTRIES=256;

function item(input){
  const v=own(ITEM_FIELDS,input);
  if(!v||!id(v.evidenceId)||!isSourceClass(v.sourceClass)||!ref(v.locatorRef)||!hash(v.contentHash)||!time(v.observedAt)||!ref(v.scopeRef))return null;
  return freezeDeep({evidenceId:v.evidenceId,sourceClass:v.sourceClass,locatorRef:v.locatorRef,contentHash:v.contentHash,observedAt:v.observedAt,scopeRef:v.scopeRef});
}
function snapshot(input){
  const v=own(SET_FIELDS,input);
  if(!v||v.version!==VERSION||!id(v.setId)||!id(v.taskRef)||!Array.isArray(v.items)||v.items.length>MAX_ITEMS||!time(v.retrievedAt))return null;
  const items=v.items.map(item);
  if(items.some(x=>!x)||new Set(items.map(x=>x.evidenceId)).size!==items.length)return null;
  return freezeDeep({version:VERSION,setId:v.setId,taskRef:v.taskRef,items,retrievedAt:v.retrievedAt});
}
function mapSnapshot(input){
  const v=own(MAP_FIELDS,input);
  if(!v||v.version!==MAP_VERSION||!id(v.mapId)||!id(v.taskRef)||!Array.isArray(v.entries)||v.entries.length>MAX_ENTRIES)return null;
  const entries=v.entries.map(entry=>{const e=own(ENTRY_FIELDS,entry);if(!e||!id(e.claimId)||!Array.isArray(e.evidenceIds)||e.evidenceIds.length>64||!e.evidenceIds.every(id)||new Set(e.evidenceIds).size!==e.evidenceIds.length)return null;return {claimId:e.claimId,evidenceIds:[...e.evidenceIds]};});
  if(entries.some(e=>!e)||new Set(entries.map(e=>e.claimId)).size!==entries.length)return null;
  return freezeDeep({version:MAP_VERSION,mapId:v.mapId,taskRef:v.taskRef,entries});
}
function contains(set,evidenceId){const s=snapshot(set);return Boolean(s)&&id(evidenceId)&&s.items.some(x=>x.evidenceId===evidenceId);}
// Per-claim provenance status. A claim whose evidence is only MODEL_MEMORY / MODEL_INFERENCE is UNSUPPORTED.
function verifyMap(map,set){
  const m=mapSnapshot(map),s=snapshot(set);
  if(!m||!s||m.taskRef!==s.taskRef)return Object.freeze({version:MAP_VERSION,status:'MAP_INVALID',reasonCode:!m?'MAP_INVALID':!s?'SET_INVALID':'TASK_MISMATCH',claims:Object.freeze([])});
  const byId=new Map(s.items.map(x=>[x.evidenceId,x]));
  const claims=m.entries.map(entry=>{
    if(!entry.evidenceIds.length)return {claimId:entry.claimId,status:'UNBOUND'};
    const missing=entry.evidenceIds.filter(x=>!byId.has(x));
    if(missing.length)return {claimId:entry.claimId,status:'UNKNOWN_EVIDENCE',missing};
    const observed=entry.evidenceIds.some(x=>dimension(byId.get(x).sourceClass)==='OBSERVED');
    return {claimId:entry.claimId,status:observed?'BOUND':'UNSUPPORTED_NON_AUTHORITATIVE'};
  });
  const status=claims.every(c=>c.status==='BOUND')?'MAP_BOUND':'MAP_UNBOUND';
  return freezeDeep({version:MAP_VERSION,status,reasonCode:null,claims});
}
function foreignItems(set,context){
  const s=snapshot(set);if(!s)return Object.freeze([]);
  return Object.freeze(s.items.filter(x=>isolationCheck(context,x.scopeRef).status!=='IN_SCOPE').map(x=>x.evidenceId));
}
module.exports=Object.freeze({VERSION,MAP_VERSION,ITEM_FIELDS,SET_FIELDS,MAP_FIELDS,item,snapshot,mapSnapshot,contains,verifyMap,foreignItems});

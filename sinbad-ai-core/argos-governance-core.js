'use strict';

const crypto=require('node:crypto');

const VERSION='sinbad-argos-governance/1-v1';
const ENTRY_KINDS=Object.freeze(['SOURCE','CONFIG','WORKFLOW','MIGRATION','ASSET','TEST','DOCUMENT']);
const EVENT_KINDS=Object.freeze(['OBSERVED','CHANGE_DETECTED','TEST_STARTED','TEST_COMPLETED','REPAIR_PROPOSED','RELEASE_PROPOSED','GATE_BLOCKED']);
const COMMAND_ACTIONS=Object.freeze(['READ_ONLY','TEST','WRITE','REPAIR','DELETE','RELEASE','SUPABASE_MUTATION','CREDENTIAL_CHANGE','PHYSICAL_CONTROL']);
const OUTCOMES=Object.freeze(['RECORDED','PASSED','FAILED','BLOCKED','PROPOSED']);
const HASH=/^[a-f0-9]{64}$/u;
const MAX_ENTRIES=100000;
const MAX_EVENTS=100000;

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value){return crypto.createHash('sha256').update(Buffer.from(String(value),'utf8')).digest('hex');}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const item of Object.values(value))deepFreeze(item);return Object.freeze(value);}
function clean(value,max=200){return typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\u0000-\u001f\u007f]/u.test(value)?value:null;}
function plainExact(value,names){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return null;
  const own=Object.getOwnPropertyNames(value);
  if(own.length!==names.length||names.some(name=>!own.includes(name)))return null;
  const output=Object.create(null);
  for(const name of names){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(value,name);}catch{return null;}if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;output[name]=descriptor.value;}
  return output;
}
function validIso(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))return false;const time=Date.parse(value);return Number.isFinite(time)&&new Date(time).toISOString()===value;}
function safePath(value){return clean(value,500)&&!value.startsWith('/')&&!/^[A-Za-z]:[\\/]/u.test(value)&&!value.split(/[\\/]/u).includes('..')&&value.replaceAll('\\','/')===value?value:null;}

const authenticInventories=new WeakSet();
function createInventory(input={}){
  const root=plainExact(input,['scopeId','observedAt','entries']);
  if(!root||!clean(root.scopeId)||!validIso(root.observedAt)||!Array.isArray(root.entries)||root.entries.length>MAX_ENTRIES)throw new TypeError('ARGOS_INVENTORY_INVALID');
  const entries=[];let previous='';
  for(const candidate of root.entries){
    const entry=plainExact(candidate,['path','sha256','bytes','kind','protected']);
    if(!entry||!safePath(entry.path)||!HASH.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>Number.MAX_SAFE_INTEGER||!ENTRY_KINDS.includes(entry.kind)||typeof entry.protected!=='boolean'||entry.path<=previous)throw new TypeError('ARGOS_INVENTORY_ENTRY_INVALID');
    previous=entry.path;entries.push(Object.freeze({...entry}));
  }
  const inventoryHash=sha256(canonical({version:VERSION,scopeId:root.scopeId,observedAt:root.observedAt,entries}));
  const output=deepFreeze({version:VERSION,scopeId:root.scopeId,observedAt:root.observedAt,entries,inventoryHash});
  authenticInventories.add(output);return output;
}
function compareInventories(baseline,candidate){
  if(!authenticInventories.has(baseline)||!authenticInventories.has(candidate)||baseline.scopeId!==candidate.scopeId)return deepFreeze({version:VERSION,status:'ARGOS_COMPARISON_BLOCKED',reasonCode:'INVENTORY_AUTHORITY_INVALID',changes:[],changeSetHash:null});
  const before=new Map(baseline.entries.map(entry=>[entry.path,entry]));
  const after=new Map(candidate.entries.map(entry=>[entry.path,entry]));
  const paths=[...new Set([...before.keys(),...after.keys()])].sort();
  const changes=[];
  for(const path of paths){const oldEntry=before.get(path),newEntry=after.get(path);if(!oldEntry)changes.push({path,type:'ADDED',protected:newEntry.protected,beforeHash:null,afterHash:newEntry.sha256});else if(!newEntry)changes.push({path,type:'DELETED',protected:oldEntry.protected,beforeHash:oldEntry.sha256,afterHash:null});else if(oldEntry.sha256!==newEntry.sha256||oldEntry.bytes!==newEntry.bytes||oldEntry.kind!==newEntry.kind||oldEntry.protected!==newEntry.protected)changes.push({path,type:'MODIFIED',protected:oldEntry.protected||newEntry.protected,beforeHash:oldEntry.sha256,afterHash:newEntry.sha256});}
  const frozen=changes.map(change=>Object.freeze(change));
  const protectedChange=frozen.some(change=>change.protected);
  return deepFreeze({version:VERSION,status:frozen.length===0?'ARGOS_INTEGRITY_CLEAN':protectedChange?'ARGOS_PROTECTED_CHANGE_REVIEW_REQUIRED':'ARGOS_CHANGE_RECORDED',reasonCode:frozen.length===0?null:protectedChange?'PROTECTED_SURFACE_CHANGED':'CHANGE_DETECTED',changes:frozen,changeSetHash:sha256(canonical(frozen))});
}

function evaluateCommand(input={}){
  const value=plainExact(input,['commandId','actorId','action','targetRef','requestedAt','changeAssessment']);
  if(!value||!clean(value.commandId)||!clean(value.actorId)||!COMMAND_ACTIONS.includes(value.action)||!clean(value.targetRef,500)||!validIso(value.requestedAt)||!value.changeAssessment||typeof value.changeAssessment!=='object')return deepFreeze({version:VERSION,status:'ARGOS_COMMAND_BLOCKED',reasonCode:'COMMAND_INVALID',commandId:null,action:null,mayExecute:false});
  const assessmentStatus=value.changeAssessment.status;
  if(!['ARGOS_INTEGRITY_CLEAN','ARGOS_CHANGE_RECORDED','ARGOS_PROTECTED_CHANGE_REVIEW_REQUIRED'].includes(assessmentStatus))return deepFreeze({version:VERSION,status:'ARGOS_COMMAND_BLOCKED',reasonCode:'INTEGRITY_EVIDENCE_INVALID',commandId:value.commandId,action:value.action,mayExecute:false});
  if(value.action==='READ_ONLY')return deepFreeze({version:VERSION,status:'ARGOS_COMMAND_ADMITTED',reasonCode:null,commandId:value.commandId,action:value.action,mayExecute:true});
  if(value.action==='TEST'&&assessmentStatus!=='ARGOS_PROTECTED_CHANGE_REVIEW_REQUIRED')return deepFreeze({version:VERSION,status:'ARGOS_COMMAND_ADMITTED',reasonCode:null,commandId:value.commandId,action:value.action,mayExecute:true});
  const irreversible=['DELETE','RELEASE','SUPABASE_MUTATION','CREDENTIAL_CHANGE','PHYSICAL_CONTROL'].includes(value.action);
  return deepFreeze({version:VERSION,status:irreversible?'ARGOS_COMMAND_BLOCKED':'ARGOS_OWNER_REVIEW_REQUIRED',reasonCode:irreversible?'EXTERNAL_AUTHORITY_AND_OWNER_APPROVAL_REQUIRED':'OWNER_APPROVAL_REQUIRED',commandId:value.commandId,action:value.action,mayExecute:false});
}

function createJournal(options={}){
  const value=plainExact(options,['journalId','maxEvents']);
  if(!value||!clean(value.journalId)||!Number.isSafeInteger(value.maxEvents)||value.maxEvents<1||value.maxEvents>MAX_EVENTS)throw new TypeError('ARGOS_JOURNAL_INVALID');
  const entries=[];
  function append(candidate={}){
    if(entries.length>=value.maxEvents)throw new Error('ARGOS_JOURNAL_CAPACITY_REACHED');
    const event=plainExact(candidate,['eventId','observedAt','actorId','kind','targetRef','outcome','evidenceHash']);
    if(!event||!clean(event.eventId)||!validIso(event.observedAt)||!clean(event.actorId)||!EVENT_KINDS.includes(event.kind)||!clean(event.targetRef,500)||!OUTCOMES.includes(event.outcome)||!HASH.test(event.evidenceHash)||entries.some(item=>item.eventId===event.eventId))throw new TypeError('ARGOS_EVENT_INVALID');
    const previousHash=entries.length?entries.at(-1).eventHash:'0'.repeat(64);
    const record=deepFreeze({...event,sequence:entries.length+1,previousHash,eventHash:sha256(canonical({...event,sequence:entries.length+1,previousHash}))});
    entries.push(record);return record;
  }
  function snapshot(){return deepFreeze({version:VERSION,journalId:value.journalId,eventCount:entries.length,headHash:entries.length?entries.at(-1).eventHash:'0'.repeat(64),entries:[...entries]});}
  return Object.freeze({version:VERSION,append,snapshot});
}

module.exports=Object.freeze({VERSION,ENTRY_KINDS,EVENT_KINDS,COMMAND_ACTIONS,OUTCOMES,canonical,sha256,createInventory,compareInventories,evaluateCommand,createJournal});

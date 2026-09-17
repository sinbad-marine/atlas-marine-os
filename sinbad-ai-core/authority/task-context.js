'use strict';
// TaskContext: the identity a request carries through the future Sentinel -> Gatekeeper -> Pilot ->
// Co-Pilot loop. Workflow, surface, principal, authority and evidence-scope references are opaque
// identifiers resolved by the product layer; the core never embeds product names.
const {own,id,ref,idList,nullableHash,time,language,freezeDeep}=require('./exact');
const VERSION='sinbad-task-context/1-v1';
const FIELDS=Object.freeze(['version','taskId','workflowRef','surfaceRef','principalRef','authorityRefs','evidenceScopeRef','stateSnapshotRef','language','requestedAt','expiresAt']);
const MAX_LIFETIME_MS=24*60*60*1000;

function snapshot(input){
  const value=own(FIELDS,input);
  if(!value||value.version!==VERSION||!id(value.taskId)||!ref(value.workflowRef)||!ref(value.surfaceRef)||!ref(value.principalRef)||!idList(value.authorityRefs)||!ref(value.evidenceScopeRef)||!nullableHash(value.stateSnapshotRef)||!language(value.language)||!time(value.requestedAt)||!time(value.expiresAt))return null;
  if(value.expiresAt<=value.requestedAt||value.expiresAt-value.requestedAt>MAX_LIFETIME_MS)return null;
  return freezeDeep({version:VERSION,taskId:value.taskId,workflowRef:value.workflowRef,surfaceRef:value.surfaceRef,principalRef:value.principalRef,authorityRefs:[...value.authorityRefs],evidenceScopeRef:value.evidenceScopeRef,stateSnapshotRef:value.stateSnapshotRef,language:value.language,requestedAt:value.requestedAt,expiresAt:value.expiresAt});
}
function isExpired(context,now){const c=snapshot(context);if(!c||!time(now))return true;return now>=c.expiresAt;}
// Evidence from another scope is FOREIGN: it may be used only after explicit retrieval with provenance
// and must be labelled; it never silently joins the task's evidence set.
function isolationCheck(context,scopeRef){
  const c=snapshot(context);
  if(!c||!ref(scopeRef))return Object.freeze({version:VERSION,status:'INVALID'});
  return Object.freeze({version:VERSION,status:scopeRef===c.evidenceScopeRef?'IN_SCOPE':'FOREIGN_SCOPE',taskId:c.taskId,evidenceScopeRef:c.evidenceScopeRef,scopeRef});
}
module.exports=Object.freeze({VERSION,FIELDS,MAX_LIFETIME_MS,snapshot,isExpired,isolationCheck});

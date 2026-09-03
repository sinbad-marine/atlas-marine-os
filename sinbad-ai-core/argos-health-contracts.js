'use strict';

const VERSION='sinbad-argos-health/1-v1';
const COMPONENTS=Object.freeze(['APPLICATION','BRIDGE','LOCAL_MODEL','GITHUB','SUPABASE','TEST_SUITE','RELEASE_PIPELINE']);
const STATES=Object.freeze(['HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN']);
const HASH=/^[a-f0-9]{64}$/u;
function exact(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return null;const keys=Object.getOwnPropertyNames(value);if(keys.length!==names.length||names.some(k=>!keys.includes(k)))return null;const out={};for(const k of names){let d;try{d=Object.getOwnPropertyDescriptor(value,k);}catch{return null;}if(!d||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;}
function clean(v,max=300){return typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&!/[\u0000-\u001f\u007f]/u.test(v)?v:null;}
function iso(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;}
function observe(input={}){const v=exact(input,['component','state','observedAt','validUntil','reasonCode','evidenceHash']);if(!v||!COMPONENTS.includes(v.component)||!STATES.includes(v.state)||!iso(v.observedAt)||!iso(v.validUntil)||Date.parse(v.validUntil)<=Date.parse(v.observedAt)||Date.parse(v.validUntil)-Date.parse(v.observedAt)>21600000||(v.reasonCode!==null&&!clean(v.reasonCode))||!HASH.test(v.evidenceHash)||(v.state==='HEALTHY'&&v.reasonCode!==null)||(v.state!=='HEALTHY'&&v.reasonCode===null))return Object.freeze({version:VERSION,status:'ARGOS_HEALTH_OBSERVATION_BLOCKED',reasonCode:'HEALTH_OBSERVATION_INVALID',component:null,state:'UNKNOWN',evidenceHash:null});return Object.freeze({version:VERSION,status:'ARGOS_HEALTH_OBSERVED',reasonCode:v.reasonCode,component:v.component,state:v.state,observedAt:v.observedAt,validUntil:v.validUntil,evidenceHash:v.evidenceHash});}
function assess(observations,now){
  const blocked=()=>Object.freeze({version:VERSION,status:'ARGOS_HEALTH_BLOCKED',reasonCode:'HEALTH_SET_INVALID',components:Object.freeze([])});
  if(!Array.isArray(observations)||!iso(now)||observations.length>COMPONENTS.length)return blocked();
  const map=new Map();
  for(const candidate of observations){
    const item=exact(candidate,['version','status','reasonCode','component','state','observedAt','validUntil','evidenceHash']);
    if(!item||item.version!==VERSION||item.status!=='ARGOS_HEALTH_OBSERVED'||map.has(item.component))return blocked();
    // Revalidate serialized observations; shape validation is not issuer authentication.
    const normalized=observe({component:item.component,state:item.state,observedAt:item.observedAt,validUntil:item.validUntil,reasonCode:item.reasonCode,evidenceHash:item.evidenceHash});
    if(normalized.status!=='ARGOS_HEALTH_OBSERVED'||Date.parse(item.observedAt)>Date.parse(now))return blocked();
    map.set(item.component,normalized);
  }
  const components=COMPONENTS.map(component=>{
    const item=map.get(component);
    if(!item||Date.parse(now)>=Date.parse(item.validUntil))return Object.freeze({component,state:'UNKNOWN',reasonCode:item?'HEALTH_EVIDENCE_EXPIRED':'HEALTH_EVIDENCE_MISSING'});
    return Object.freeze({component,state:item.state,reasonCode:item.reasonCode});
  });
  const releaseCritical=new Set(['APPLICATION','TEST_SUITE','RELEASE_PIPELINE']);
  const releaseBlocked=components.some(x=>releaseCritical.has(x.component)&&x.state!=='HEALTHY');
  const degraded=components.some(x=>x.state!=='HEALTHY');
  return Object.freeze({version:VERSION,status:releaseBlocked?'ARGOS_RELEASE_HEALTH_BLOCKED':degraded?'ARGOS_SYSTEM_DEGRADED':'ARGOS_SYSTEM_HEALTHY',reasonCode:releaseBlocked?'RELEASE_CRITICAL_HEALTH_UNSATISFIED':degraded?'COMPONENT_HEALTH_UNSATISFIED':null,components:Object.freeze(components)});
}
module.exports=Object.freeze({VERSION,COMPONENTS,STATES,observe,assess});

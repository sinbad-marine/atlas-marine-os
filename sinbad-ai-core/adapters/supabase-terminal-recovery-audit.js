'use strict';
const {createHash}=require('node:crypto');
const KEY=/^[a-f0-9]{64}$/u,ACTIONS=new Set(['OPERATOR_QUARANTINED']),REASONS=new Set(['PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED']);
const AUDIT_VERSION='sinbad-terminal-recovery-audit/3D-v2',SCAN_VERSION='sinbad-terminal-recovery-audit-scan/3E-v1';
const ROW_FIELDS=Object.freeze(['id','event_time_ms','claim_key','actor_hash','action','reason_code','created_at','event_hash']);
function hash(row){return createHash('sha256').update([AUDIT_VERSION,row.id,row.eventTimeMs,row.claimKey,row.actorHash,row.action,row.reasonCode].join('\n'),'utf8').digest('hex');}
function report(status,reasonCode,events=[]){return Object.freeze({version:AUDIT_VERSION,status,reasonCode,eventCount:events.length,events:Object.freeze(events)});}
function scanReport(status,reasonCode,eventCount=0,pageCount=0,watermarkId=null){return Object.freeze({version:SCAN_VERSION,status,reasonCode,eventCount,pageCount,watermarkId});}
function parseRows(data){
  if(!Array.isArray(data))return null;
  const events=[];
  for(const row of data){
    if(!row||typeof row!=='object')return null;const raw=Object.create(null);for(const name of ROW_FIELDS){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(row,name);}catch{return null;}if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;raw[name]=descriptor.value;}
    if(!Number.isSafeInteger(raw.id)||!Number.isSafeInteger(raw.event_time_ms))return null;for(const name of ['claim_key','actor_hash','action','reason_code','created_at','event_hash'])if(typeof raw[name]!=='string')return null;
    const event=Object.freeze({id:raw.id,eventTimeMs:raw.event_time_ms,claimKey:raw.claim_key,actorHash:raw.actor_hash,action:raw.action,reasonCode:raw.reason_code,createdAt:raw.created_at,eventHash:raw.event_hash});
    if(!Number.isSafeInteger(event.id)||event.id<1||!Number.isSafeInteger(event.eventTimeMs)||event.eventTimeMs<1||!KEY.test(event.claimKey)||!KEY.test(event.actorHash)||!ACTIONS.has(event.action)||!REASONS.has(event.reasonCode)||Date.parse(event.createdAt)!==event.eventTimeMs||!KEY.test(event.eventHash)||hash(event)!==event.eventHash)return null;
    events.push(event);
  }
  return Object.freeze(events);
}
function inputPolicy(input,fields){if(!input||typeof input!=='object')return null;const output=Object.create(null);for(const [name,fallback] of fields){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(input,name);}catch{return null;}if(descriptor!==undefined&&!Object.hasOwn(descriptor,'value'))return null;const value=descriptor===undefined?fallback:descriptor.value;if(value===null&&name==='beforeId'){output[name]=null;continue;}if(!Number.isSafeInteger(value))return null;output[name]=value;}return Object.freeze(output);}
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted server-side Supabase service-role client is required');
  const client=options.client;
  async function verify(){const {data,error}=await client.rpc('verify_terminal_recovery_audit_access',{});return !error&&data===true;}
  async function page(limit,beforeId){const {data,error}=await client.rpc('list_terminal_recovery_audit',{p_limit:limit,p_before_id:beforeId});if(error)return Object.freeze({events:null,reasonCode:'AUDIT_STORE_UNAVAILABLE'});const events=parseRows(data);return Object.freeze({events,reasonCode:events===null?'AUDIT_EVENT_HASH_MISMATCH':null});}
  return Object.freeze({
    healthCheck:verify,
    async inspect(input={}){const policy=inputPolicy(input,[['limit',100],['beforeId',null]]);if(!policy||policy.limit<1||policy.limit>500||(policy.beforeId!==null&&policy.beforeId<1))return report('AUDIT_UNAVAILABLE','AUDIT_INVALID_INSPECT_ARGS');const {limit,beforeId}=policy;if(!await verify())return report('AUDIT_UNAVAILABLE','AUDIT_CAPABILITY_DENIED');const result=await page(limit,beforeId);if(result.events===null)return report(result.reasonCode==='AUDIT_STORE_UNAVAILABLE'?'AUDIT_UNAVAILABLE':'AUDIT_INTEGRITY_FAILED',result.reasonCode);return report('AUDIT_PAGE_VALID',null,result.events);},
    async scan(input={}){const policy=inputPolicy(input,[['pageSize',100],['maxEvents',10000]]);if(!policy||policy.pageSize<1||policy.pageSize>500||policy.maxEvents<policy.pageSize||policy.maxEvents>100000)return scanReport('AUDIT_SCAN_UNAVAILABLE','AUDIT_INVALID_SCAN_ARGS');const {pageSize,maxEvents}=policy;let beforeId=null,watermarkId=null,eventCount=0,pageCount=0,previousId=Number.MAX_SAFE_INTEGER;const seen=new Set();while(true){if(!await verify())return scanReport('AUDIT_SCAN_UNAVAILABLE','AUDIT_CAPABILITY_DENIED',eventCount,pageCount,watermarkId);const result=await page(pageSize,beforeId),events=result.events;if(events===null)return scanReport(result.reasonCode==='AUDIT_STORE_UNAVAILABLE'?'AUDIT_SCAN_UNAVAILABLE':'AUDIT_SCAN_INTEGRITY_FAILED',result.reasonCode,eventCount,pageCount,watermarkId);pageCount++;if(events.length===0)return scanReport('AUDIT_SCAN_COMPLETE',null,eventCount,pageCount,watermarkId);if(watermarkId===null)watermarkId=events[0].id;let budgetReached=false;for(const event of events){if(event.id>=previousId||seen.has(event.id))return scanReport('AUDIT_SCAN_INTEGRITY_FAILED','AUDIT_ORDER_INVALID',eventCount,pageCount,watermarkId);seen.add(event.id);previousId=event.id;if(eventCount<maxEvents)eventCount++;else budgetReached=true;}if(eventCount>=maxEvents||budgetReached)return scanReport('AUDIT_SCAN_INCOMPLETE','AUDIT_SCAN_LIMIT_REACHED',eventCount,pageCount,watermarkId);beforeId=events[events.length-1].id;}
    }
  });
}
module.exports=Object.freeze({AUDIT_VERSION,SCAN_VERSION,create});

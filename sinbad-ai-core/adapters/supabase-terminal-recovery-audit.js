'use strict';
const {createHash}=require('node:crypto');
const KEY=/^[a-f0-9]{64}$/u,ACTIONS=new Set(['OPERATOR_QUARANTINED']),REASONS=new Set(['PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED']);
const AUDIT_VERSION='sinbad-terminal-recovery-audit/3D-v2';
function hash(row){return createHash('sha256').update([AUDIT_VERSION,row.id,row.eventTimeMs,row.claimKey,row.actorHash,row.action,row.reasonCode].join('\n'),'utf8').digest('hex');}
function report(status,reasonCode,events=[]){return Object.freeze({version:AUDIT_VERSION,status,reasonCode,eventCount:events.length,events:Object.freeze(events)});}
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted server-side Supabase service-role client is required');
  const client=options.client;
  async function verify(){const {data,error}=await client.rpc('verify_terminal_recovery_audit_access',{});return !error&&data===true;}
  return Object.freeze({
    healthCheck:verify,
    async inspect(input={}){const limit=Number(input.limit??100),beforeId=input.beforeId==null?null:Number(input.beforeId);if(!Number.isInteger(limit)||limit<1||limit>500||(beforeId!==null&&(!Number.isSafeInteger(beforeId)||beforeId<1)))return report('AUDIT_UNAVAILABLE','AUDIT_INVALID_INSPECT_ARGS');if(!await verify())return report('AUDIT_UNAVAILABLE','AUDIT_CAPABILITY_DENIED');const {data,error}=await client.rpc('list_terminal_recovery_audit',{p_limit:limit,p_before_id:beforeId});if(error||!Array.isArray(data))return report('AUDIT_UNAVAILABLE','AUDIT_STORE_UNAVAILABLE');const events=[];for(const row of data){const event=Object.freeze({id:Number(row?.id),eventTimeMs:Number(row?.event_time_ms),claimKey:String(row?.claim_key||''),actorHash:String(row?.actor_hash||''),action:String(row?.action||''),reasonCode:String(row?.reason_code||''),createdAt:String(row?.created_at||''),eventHash:String(row?.event_hash||'')});if(!Number.isSafeInteger(event.id)||event.id<1||!Number.isSafeInteger(event.eventTimeMs)||event.eventTimeMs<1||!KEY.test(event.claimKey)||!KEY.test(event.actorHash)||!ACTIONS.has(event.action)||!REASONS.has(event.reasonCode)||Date.parse(event.createdAt)!==event.eventTimeMs||!KEY.test(event.eventHash)||hash(event)!==event.eventHash)return report('AUDIT_INTEGRITY_FAILED','AUDIT_EVENT_HASH_MISMATCH');events.push(event);}return report('AUDIT_PAGE_VALID',null,events);}
  });
}
module.exports=Object.freeze({AUDIT_VERSION,create});

'use strict';
const contract=require('./durable-idempotency-store.js');
const KEY=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH=/^[a-f0-9]{64}$/u,STAGES=new Set(['COMPLETION_DENIED','TRANSITION_DENIED','TERMINAL_CHAIN_EXCEPTION']);
function validSummary(value){if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.byteLength(JSON.stringify(value),'utf8')>4096)return false;const keys=Object.keys(value),allowed=new Set(['status','terminalState','outcome','transitionHash','stage','completionHash']);if(keys.some(key=>!allowed.has(key)))return false;if(value.status==='TRUSTED_TERMINAL_DELIVERY_APPLIED')return ['DELIVERY_SUCCEEDED','DELIVERY_FAILED'].includes(value.terminalState)&&['DELIVERED','FAILED'].includes(value.outcome)&&HASH.test(value.transitionHash||'')&&!('stage'in value)&&!('completionHash'in value);if(value.status==='TRUSTED_TERMINAL_DELIVERY_BLOCKED')return value.outcome===null&&STAGES.has(value.stage)&&(!('completionHash'in value)||HASH.test(value.completionHash||''))&&!('terminalState'in value)&&!('transitionHash'in value);return false;}
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function')throw new TypeError('A trusted Supabase service-role client is required');
  if(options.serviceRole!==true)throw new TypeError('Explicit server-side serviceRole confirmation is required');
  let leaseDescriptor;try{leaseDescriptor=Object.getOwnPropertyDescriptor(options,'claimLeaseMs');}catch{throw new TypeError('claimLeaseMs must be between 1000 and 900000');}const claimLeaseMs=leaseDescriptor&&Object.hasOwn(leaseDescriptor,'value')?leaseDescriptor.value:null;if(!Number.isSafeInteger(claimLeaseMs)||claimLeaseMs<1000||claimLeaseMs>900000)throw new TypeError('claimLeaseMs must be between 1000 and 900000');
  const client=options.client,tokens=new Map();
  return Object.freeze({version:contract.STORE_VERSION,durable:true,claimLeaseMs,
    async claim(key){if(typeof key!=='string'||!KEY.test(key)||tokens.has(key))return false;const {data,error}=await client.rpc('claim_terminal_delivery',{p_claim_key:key,p_lease_ms:claimLeaseMs});if(error||typeof data!=='string'||!UUID.test(data))return false;tokens.set(key,data);return true;},
    async settle(key,summary){const token=tokens.get(key);if(!KEY.test(key)||!token||!validSummary(summary))return false;const {data,error}=await client.rpc('settle_terminal_delivery',{p_claim_key:key,p_lease_token:token,p_summary:summary});if(error)return false;tokens.delete(key);return data===true;}
  });
}
module.exports=Object.freeze({create});

'use strict';
const contract=require('./durable-idempotency-store.js');
const KEY=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH=/^[a-f0-9]{64}$/u,STAGES=new Set(['COMPLETION_DENIED','TRANSITION_DENIED','TERMINAL_CHAIN_EXCEPTION']);
const SUMMARY_FIELDS=new Set(['status','terminalState','outcome','transitionHash','stage','completionHash']);
function summarySnapshot(value){if(!value||typeof value!=='object'||Array.isArray(value))return null;let keys;try{keys=Reflect.ownKeys(value);}catch{return null;}if(keys.some(key=>typeof key!=='string'||!SUMMARY_FIELDS.has(key)))return null;const output={};for(const key of keys){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch{return null;}if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return null;const field=descriptor.value;if(field!==null&&typeof field!=='string')return null;output[key]=field;}if(output.status==='TRUSTED_TERMINAL_DELIVERY_APPLIED'){if(!['DELIVERY_SUCCEEDED','DELIVERY_FAILED'].includes(output.terminalState)||!['DELIVERED','FAILED'].includes(output.outcome)||typeof output.transitionHash!=='string'||!HASH.test(output.transitionHash)||Object.hasOwn(output,'stage')||Object.hasOwn(output,'completionHash'))return null;}else if(output.status==='TRUSTED_TERMINAL_DELIVERY_BLOCKED'){if(output.outcome!==null||!STAGES.has(output.stage)||(Object.hasOwn(output,'completionHash')&&(typeof output.completionHash!=='string'||!HASH.test(output.completionHash)))||Object.hasOwn(output,'terminalState')||Object.hasOwn(output,'transitionHash'))return null;}else return null;let encoded;try{encoded=JSON.stringify(output);}catch{return null;}return Buffer.byteLength(encoded,'utf8')<=4096?Object.freeze(output):null;}
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function')throw new TypeError('A trusted Supabase service-role client is required');
  if(options.serviceRole!==true)throw new TypeError('Explicit server-side serviceRole confirmation is required');
  let leaseDescriptor;try{leaseDescriptor=Object.getOwnPropertyDescriptor(options,'claimLeaseMs');}catch{throw new TypeError('claimLeaseMs must be between 1000 and 900000');}const claimLeaseMs=leaseDescriptor&&Object.hasOwn(leaseDescriptor,'value')?leaseDescriptor.value:null;if(!Number.isSafeInteger(claimLeaseMs)||claimLeaseMs<1000||claimLeaseMs>900000)throw new TypeError('claimLeaseMs must be between 1000 and 900000');
  const client=options.client,tokens=new Map();
  return Object.freeze({version:contract.STORE_VERSION,durable:true,claimLeaseMs,
    async claim(key){if(typeof key!=='string'||!KEY.test(key)||tokens.has(key))return false;const {data,error}=await client.rpc('claim_terminal_delivery',{p_claim_key:key,p_lease_ms:claimLeaseMs});if(error||typeof data!=='string'||!UUID.test(data))return false;tokens.set(key,data);return true;},
    async settle(key,summary){if(typeof key!=='string'||!KEY.test(key))return false;const token=tokens.get(key),snapshot=summarySnapshot(summary);if(!token||!snapshot)return false;const {data,error}=await client.rpc('settle_terminal_delivery',{p_claim_key:key,p_lease_token:token,p_summary:snapshot});if(error)return false;tokens.delete(key);return data===true;}
  });
}
module.exports=Object.freeze({create});

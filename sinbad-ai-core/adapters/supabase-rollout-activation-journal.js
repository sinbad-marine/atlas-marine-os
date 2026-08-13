'use strict';
const HASH=/^[a-f0-9]{64}$/u,STATES=new Set(['PENDING','APPLIED','REJECTED','UNKNOWN']);
const JOURNAL_VERSION='sinbad-supabase-rollout-activation-journal/3J-v1';
const output=(status,state=null)=>Object.freeze({status,state});
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted Supabase service-role client is required');
  const client=Object.freeze({rpc:options.client.rpc.bind(options.client)});
  return Object.freeze({version:JOURNAL_VERSION,durable:true,
    async begin(attestationHash){if(!HASH.test(attestationHash||''))return output('INVALID');try{const {data,error}=await client.rpc('begin_terminal_rollout_activation',{p_attestation_hash:attestationHash});return !error&&['BEGUN','EXISTS','DENIED'].includes(data)?output(data):output('UNAVAILABLE');}catch{return output('UNAVAILABLE');}},
    async settle(attestationHash,expectedStatus,status){if(!HASH.test(attestationHash||'')||!['PENDING','UNKNOWN'].includes(expectedStatus)||!['APPLIED','REJECTED','UNKNOWN'].includes(status)||(expectedStatus==='UNKNOWN'&&status==='UNKNOWN'))return output('INVALID');try{const {data,error}=await client.rpc('settle_terminal_rollout_activation',{p_attestation_hash:attestationHash,p_expected_status:expectedStatus,p_status:status});return !error&&['SETTLED','ALREADY_SETTLED','CONFLICT','DENIED'].includes(data)?output(data):output('UNAVAILABLE');}catch{return output('UNAVAILABLE');}},
    async inspect(attestationHash){if(!HASH.test(attestationHash||''))return output('INVALID');try{const {data,error}=await client.rpc('inspect_terminal_rollout_activation',{p_attestation_hash:attestationHash});if(error||!Array.isArray(data))return output('UNAVAILABLE');if(data.length===0)return output('ABSENT');if(data.length!==1)return output('UNAVAILABLE');const row=data[0],status=String(row?.status||''),startedAt=String(row?.started_at||''),updatedAt=String(row?.updated_at||'');if(!STATES.has(status)||!Number.isFinite(Date.parse(startedAt))||!Number.isFinite(Date.parse(updatedAt))||Date.parse(updatedAt)<Date.parse(startedAt))return output('UNAVAILABLE');return output('FOUND',Object.freeze({status,startedAt,updatedAt}));}catch{return output('UNAVAILABLE');}}
  });
}
module.exports=Object.freeze({JOURNAL_VERSION,create});

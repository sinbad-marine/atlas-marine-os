'use strict';
const AUDIT_VERSION='sinbad-trusted-rollout-recovery-authorization-audit/3N-v1';
const HASH=/^[a-f0-9]{64}$/u,DECISIONS=new Set(['AUTHORIZED','DENIED']);
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted Supabase service-role client is required');
  const rpc=options.client.rpc.bind(options.client);
  return Object.freeze({version:AUDIT_VERSION,durable:true,async append(event={}){if(event.version!==AUDIT_VERSION||!HASH.test(event.actorHash||'')||!HASH.test(event.attestationHash||'')||!HASH.test(event.purposeHash||'')||!DECISIONS.has(event.decision)||!Number.isSafeInteger(event.decidedAt)||event.decidedAt<0||!HASH.test(event.eventHash||''))return false;try{const {data,error}=await rpc('append_rollout_recovery_authorization_audit',{p_actor_hash:event.actorHash,p_attestation_hash:event.attestationHash,p_purpose_hash:event.purposeHash,p_decision:event.decision,p_decided_at_ms:event.decidedAt,p_event_hash:event.eventHash});return !error&&(data==='RECORDED'||data==='ALREADY_RECORDED');}catch{return false;}}});
}
module.exports=Object.freeze({AUDIT_VERSION,create});

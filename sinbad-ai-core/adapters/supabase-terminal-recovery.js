'use strict';
const KEY=/^[a-f0-9]{64}$/u,REASONS=new Set(['PROCESS_CRASH','SETTLEMENT_AMBIGUOUS','LEASE_EXPIRED']);
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted server-side Supabase service-role client is required');
  const actorHash=String(options.actorHash||'');if(!KEY.test(actorHash))throw new TypeError('A SHA-256 operator identity is required');
  const client=options.client;
  async function verify(){const {data,error}=await client.rpc('verify_terminal_recovery_access',{});return !error&&data===true;}
  return Object.freeze({
    healthCheck:verify,
    async listExpired(limit=100){const value=Number(limit);if(!Number.isInteger(value)||value<1||value>500||!await verify())return Object.freeze([]);const {data,error}=await client.rpc('list_expired_terminal_delivery_claims',{p_limit:value});if(error||!Array.isArray(data))return Object.freeze([]);return Object.freeze(data.filter(row=>KEY.test(String(row?.claim_key||''))&&Number.isFinite(Date.parse(row?.claimed_at||''))&&Number.isFinite(Date.parse(row?.lease_expires_at||''))).map(row=>Object.freeze({claimKey:String(row.claim_key),claimedAt:String(row.claimed_at),leaseExpiresAt:String(row.lease_expires_at)})));},
    async quarantine(input={}){const claimKey=String(input.claimKey||''),reasonCode=String(input.reasonCode||'');if(!KEY.test(claimKey)||!REASONS.has(reasonCode)||!await verify())return false;const {data,error}=await client.rpc('quarantine_expired_terminal_delivery_claim',{p_claim_key:claimKey,p_actor_hash:actorHash,p_reason_code:reasonCode});return !error&&data===true;}
  });
}
module.exports=Object.freeze({create});

'use strict';
const journalModule=require('./supabase-rollout-activation-journal.js');
const storeModule=require('./supabase-rollout-recovery-authorization-audit.js');
const auditModule=require('./trusted-rollout-recovery-authorization-audit.js');
const verifierModule=require('./supabase-rollout-recovery-authorization-audit-verifier.js');
const readinessModule=require('./rollout-recovery-authorization-audit-readiness.js');
const authorizationModule=require('./trusted-terminal-rollout-recovery-authorization.js');

const RUNTIME_VERSION='sinbad-trusted-rollout-recovery-runtime/3V-v1';
const DATABASE_FINGERPRINT='sinbad-rollout-recovery-db/3U-20260820-v1';
const EXPECTED=Object.freeze({
  journal:'sinbad-supabase-rollout-activation-journal/3J-v1',
  auditEvent:'sinbad-trusted-rollout-recovery-authorization-audit/3N-v1',
  verifier:'sinbad-supabase-rollout-recovery-authorization-audit-verifier/3P-v1',
  readiness:'sinbad-rollout-recovery-authorization-audit-readiness/3Q-v1',
  authorization:'sinbad-trusted-terminal-rollout-recovery-authorization/3R-v1'
});
if(journalModule.JOURNAL_VERSION!==EXPECTED.journal||storeModule.AUDIT_VERSION!==EXPECTED.auditEvent||auditModule.AUDIT_VERSION!==EXPECTED.auditEvent||verifierModule.VERIFIER_VERSION!==EXPECTED.verifier||readinessModule.READINESS_VERSION!==EXPECTED.readiness||authorizationModule.AUTHORIZATION_VERSION!==EXPECTED.authorization)throw new Error('Unsupported trusted rollout recovery runtime chain');

function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted Supabase service-role client is required');
  if(typeof options.authorize!=='function'||typeof options.resolve!=='function'||typeof options.now!=='function')throw new TypeError('Trusted authorize, resolve and clock functions are required');
  const pageSize=Number(options.auditPageSize),maxEvents=Number(options.auditMaxEvents);
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500||!Number.isInteger(maxEvents)||maxEvents<pageSize||maxEvents>100000)throw new TypeError('Bounded audit readiness scan policy is required');
  const base=Object.freeze({client:options.client,serviceRole:true,actorHash:options.actorHash,recoveryPurpose:options.recoveryPurpose,authorizationTtlMs:options.authorizationTtlMs,authorizationTimeoutMs:options.authorizationTimeoutMs,now:options.now,authorize:options.authorize,resolve:options.resolve,recoveryTimeoutMs:options.recoveryTimeoutMs});
  const journal=journalModule.create(base),store=storeModule.create(base),audit=auditModule.create({durable:true,append:event=>store.append(event)}),verifier=verifierModule.create(base),readiness=readinessModule.create({auditVerifier:verifier,pageSize,maxEvents}),authorization=authorizationModule.create({...base,activationJournal:journal,authorizationAudit:audit,auditReadiness:readiness});
  let verified=false,pending=null;
  async function preflight(){if(verified)return true;if(pending)return pending;pending=(async()=>{try{const {data,error}=await options.client.rpc('verify_rollout_recovery_runtime_access',{});return !error&&data===DATABASE_FINGERPRINT;}catch{return false;}})();const value=await pending;pending=null;if(value)verified=true;return value;}
  async function healthCheck(){if(!await preflight())return Object.freeze({version:RUNTIME_VERSION,status:'ROLLOUT_RECOVERY_RUNTIME_BLOCKED',reasonCode:'RUNTIME_PREFLIGHT_REQUIRED',eventCount:null,pageCount:null,watermarkId:null});let state;try{state=await readiness.check();}catch{return Object.freeze({version:RUNTIME_VERSION,status:'ROLLOUT_RECOVERY_RUNTIME_BLOCKED',reasonCode:'AUDIT_READINESS_EXCEPTION',eventCount:null,pageCount:null,watermarkId:null});}const ready=state?.version===EXPECTED.readiness&&state.status==='AUTHORIZATION_AUDIT_READINESS_READY'&&state.reasonCode===null;return Object.freeze({version:RUNTIME_VERSION,status:ready?'ROLLOUT_RECOVERY_RUNTIME_READY':'ROLLOUT_RECOVERY_RUNTIME_BLOCKED',reasonCode:ready?null:String(state?.reasonCode||'AUDIT_READINESS_NOT_READY'),eventCount:Number.isSafeInteger(state?.eventCount)?state.eventCount:null,pageCount:Number.isSafeInteger(state?.pageCount)?state.pageCount:null,watermarkId:Number.isSafeInteger(state?.watermarkId)?state.watermarkId:null});}
  return Object.freeze({version:RUNTIME_VERSION,healthCheck,async issue(value){if(!await preflight())return Object.freeze({version:EXPECTED.authorization,status:'ROLLOUT_RECOVERY_AUTHORIZATION_BLOCKED',reasonCode:'RUNTIME_PREFLIGHT_REQUIRED',authorizationHash:null,issuedAt:null,expiresAt:null});return authorization.issue(value);},async recover(value){if(!await preflight())return Object.freeze({version:'sinbad-trusted-terminal-rollout-recovery/3L-v1',status:'ROLLOUT_RECOVERY_BLOCKED',reasonCode:'RUNTIME_PREFLIGHT_REQUIRED',attestationHash:null});return authorization.recover(value);}});
}
module.exports=Object.freeze({RUNTIME_VERSION,DATABASE_FINGERPRINT,EXPECTED,create});

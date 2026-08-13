'use strict';
const attestations=require('./supabase-terminal-recovery-attestation.js');
const ACTIVATION_VERSION='sinbad-trusted-terminal-rollout-activation/3H-v1';
const EXPECTED_ATTESTATION_VERSION='sinbad-terminal-recovery-readiness-attestation/3G-v1';
if(attestations.ATTESTATION_VERSION!==EXPECTED_ATTESTATION_VERSION)throw new Error(`Unsupported attestation version: ${attestations.ATTESTATION_VERSION}`);
function result(status,reasonCode,attestationHash=null){return Object.freeze({version:ACTIVATION_VERSION,status,reasonCode,attestationHash:/^[a-f0-9]{64}$/u.test(attestationHash||'')?attestationHash:null});}
function create(options={}){
  if(typeof options.activate!=='function')throw new TypeError('A trusted activate function is required');
  if(options.diagnose!==undefined&&typeof options.diagnose!=='function')throw new TypeError('diagnose must be a function');
  const timeoutMs=Number(options.activationTimeoutMs);if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new TypeError('A bounded activation timeout is required');
  const activate=options.activate,resolve=typeof options.resolve==='function'?options.resolve:null,diagnose=typeof options.diagnose==='function'?options.diagnose:()=>{},attestation=attestations.create(options),unsettled=new WeakMap(),reconciling=new WeakSet();
  function diagnostic(code){try{diagnose(Object.freeze({version:ACTIVATION_VERSION,code}));}catch{}}
  function pending(hash){const output=result('TRUSTED_ROLLOUT_ACTIVATION_UNSETTLED','ACTIVATION_OUTCOME_UNKNOWN',hash);unsettled.set(output,Object.freeze({attestationHash:hash}));return output;}
  async function bounded(hook,input){let timer;try{const timeout=Symbol('timeout'),outcome=await Promise.race([Promise.resolve().then(()=>hook(input)),new Promise(done=>{timer=setTimeout(()=>done(timeout),timeoutMs);})]);return {timedOut:outcome===timeout,value:outcome};}finally{if(timer!==undefined)clearTimeout(timer);}}
  return Object.freeze({
    issue:attestation.issue,
    async activate(value){const accepted=attestation.consume(value);if(accepted.status!=='READINESS_ATTESTATION_ACCEPTED'){diagnostic('ATTESTATION_DENIED');return result('TRUSTED_ROLLOUT_ACTIVATION_BLOCKED','ACTIVATION_DENIED');}try{const outcome=await bounded(activate,Object.freeze({attestationHash:accepted.attestationHash}));if(outcome.timedOut){diagnostic('ACTIVATION_TIMEOUT');return pending(accepted.attestationHash);}if(outcome.value===true)return result('TRUSTED_ROLLOUT_ACTIVATION_APPLIED',null,accepted.attestationHash);diagnostic('ACTIVATION_REJECTED');return result('TRUSTED_ROLLOUT_ACTIVATION_FAILED','ACTIVATION_REJECTED',accepted.attestationHash);}catch{diagnostic('ACTIVATION_EXCEPTION');return pending(accepted.attestationHash);}},
    async reconcile(value){const manifest=unsettled.get(value);if(!resolve||!manifest||reconciling.has(value)||value.status!=='TRUSTED_ROLLOUT_ACTIVATION_UNSETTLED'||value.reasonCode!=='ACTIVATION_OUTCOME_UNKNOWN'||value.attestationHash!==manifest.attestationHash)return result('TRUSTED_ROLLOUT_ACTIVATION_BLOCKED','RECONCILIATION_DENIED');reconciling.add(value);try{let outcome;try{outcome=await bounded(resolve,Object.freeze({attestationHash:manifest.attestationHash}));}catch{diagnostic('RECONCILIATION_EXCEPTION');return value;}if(outcome.timedOut){diagnostic('RECONCILIATION_TIMEOUT');return value;}if(outcome.value==='PENDING')return value;if(outcome.value==='APPLIED'){unsettled.delete(value);return result('TRUSTED_ROLLOUT_ACTIVATION_RECONCILED',null,manifest.attestationHash);}if(outcome.value==='REJECTED'){unsettled.delete(value);return result('TRUSTED_ROLLOUT_ACTIVATION_FAILED','ACTIVATION_REJECTED',manifest.attestationHash);}diagnostic('RECONCILIATION_INVALID');return value;}finally{reconciling.delete(value);}}
  });
}
module.exports=Object.freeze({ACTIVATION_VERSION,EXPECTED_ATTESTATION_VERSION,create});

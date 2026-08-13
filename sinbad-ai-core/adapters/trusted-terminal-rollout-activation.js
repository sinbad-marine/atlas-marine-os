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
  const activate=options.activate,diagnose=typeof options.diagnose==='function'?options.diagnose:()=>{},attestation=attestations.create(options);
  function diagnostic(code){try{diagnose(Object.freeze({version:ACTIVATION_VERSION,code}));}catch{}}
  return Object.freeze({
    issue:attestation.issue,
    async activate(value){const accepted=attestation.consume(value);if(accepted.status!=='READINESS_ATTESTATION_ACCEPTED'){diagnostic('ATTESTATION_DENIED');return result('TRUSTED_ROLLOUT_ACTIVATION_BLOCKED','ACTIVATION_DENIED');}let timer;try{const timeout=Symbol('timeout'),outcome=await Promise.race([Promise.resolve().then(()=>activate(Object.freeze({attestationHash:accepted.attestationHash}))),new Promise(resolve=>{timer=setTimeout(()=>resolve(timeout),timeoutMs);})]);if(outcome===true)return result('TRUSTED_ROLLOUT_ACTIVATION_APPLIED',null,accepted.attestationHash);if(outcome===timeout){diagnostic('ACTIVATION_TIMEOUT');return result('TRUSTED_ROLLOUT_ACTIVATION_UNSETTLED','ACTIVATION_OUTCOME_UNKNOWN',accepted.attestationHash);}diagnostic('ACTIVATION_REJECTED');return result('TRUSTED_ROLLOUT_ACTIVATION_FAILED','ACTIVATION_REJECTED',accepted.attestationHash);}catch{diagnostic('ACTIVATION_EXCEPTION');return result('TRUSTED_ROLLOUT_ACTIVATION_UNSETTLED','ACTIVATION_OUTCOME_UNKNOWN',accepted.attestationHash);}finally{if(timer!==undefined)clearTimeout(timer);}}
  });
}
module.exports=Object.freeze({ACTIVATION_VERSION,EXPECTED_ATTESTATION_VERSION,create});

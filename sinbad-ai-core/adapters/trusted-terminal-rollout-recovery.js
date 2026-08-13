'use strict';

const journals=require('./supabase-rollout-activation-journal.js');
const RECOVERY_VERSION='sinbad-trusted-terminal-rollout-recovery/3L-v1';
const EXPECTED_JOURNAL_VERSION='sinbad-supabase-rollout-activation-journal/3J-v1';
const HASH=/^[a-f0-9]{64}$/u;
const recovering=new Set();

if(journals.JOURNAL_VERSION!==EXPECTED_JOURNAL_VERSION)throw new Error(`Unsupported journal version: ${journals.JOURNAL_VERSION}`);

function result(status,reasonCode,attestationHash=null){
  return Object.freeze({version:RECOVERY_VERSION,status,reasonCode,attestationHash:HASH.test(attestationHash||'')?attestationHash:null});
}

function create(options={}){
  const journal=options.activationJournal;
  if(!journal||journal.version!==EXPECTED_JOURNAL_VERSION||journal.durable!==true||typeof journal.inspect!=='function'||typeof journal.settle!=='function')throw new TypeError('A trusted durable activationJournal is required');
  if(typeof options.resolve!=='function')throw new TypeError('A trusted resolve function is required');
  if(options.diagnose!==undefined&&typeof options.diagnose!=='function')throw new TypeError('diagnose must be a function');
  const timeoutMs=Number(options.recoveryTimeoutMs);
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new TypeError('A bounded recovery timeout is required');
  const resolve=options.resolve,diagnose=typeof options.diagnose==='function'?options.diagnose:()=>{};

  function diagnostic(code){try{diagnose(Object.freeze({version:RECOVERY_VERSION,code}));}catch{}}
  async function bounded(input){let timer;try{const timeout=Symbol('timeout'),value=await Promise.race([Promise.resolve().then(()=>resolve(input)),new Promise(done=>{timer=setTimeout(()=>done(timeout),timeoutMs);})]);return value===timeout?Object.freeze({status:'TIMEOUT'}):Object.freeze({status:'VALUE',value});}catch{return Object.freeze({status:'ERROR'});}finally{if(timer!==undefined)clearTimeout(timer);}}
  async function inspect(hash){try{return await journal.inspect(hash);}catch{return Object.freeze({status:'UNAVAILABLE',state:null});}}
  async function settle(hash,expected,status){try{const outcome=await journal.settle(hash,expected,status);if(outcome?.status==='SETTLED')return 'SETTLED';if(outcome?.status==='CONFLICT')return 'CONFLICT';if(outcome?.status!=='ALREADY_SETTLED')return 'UNAVAILABLE';const observed=await inspect(hash);return observed?.status==='FOUND'&&observed.state?.status===status?'SETTLED':'CONFLICT';}catch{return 'UNAVAILABLE';}}

  return Object.freeze({
    version:RECOVERY_VERSION,
    async recover(attestationHash){
      if(!HASH.test(attestationHash||''))return result('ROLLOUT_RECOVERY_BLOCKED','RECOVERY_HASH_INVALID');
      if(recovering.has(attestationHash))return result('ROLLOUT_RECOVERY_BLOCKED','RECOVERY_IN_PROGRESS',attestationHash);
      recovering.add(attestationHash);
      try{
        const observed=await inspect(attestationHash);
        if(observed?.status!=='FOUND')return result('ROLLOUT_RECOVERY_BLOCKED',observed?.status==='ABSENT'?'RECOVERY_NOT_FOUND':'RECOVERY_JOURNAL_UNAVAILABLE',attestationHash);
        const current=observed.state?.status;
        if(current==='APPLIED')return result('ROLLOUT_RECOVERY_APPLIED',null,attestationHash);
        if(current==='REJECTED')return result('ROLLOUT_RECOVERY_REJECTED','ACTIVATION_REJECTED',attestationHash);
        if(current!=='PENDING'&&current!=='UNKNOWN')return result('ROLLOUT_RECOVERY_BLOCKED','RECOVERY_JOURNAL_INVALID',attestationHash);
        const provider=await bounded(Object.freeze({attestationHash}));
        if(provider.status==='TIMEOUT'){diagnostic('RECOVERY_TIMEOUT');return result('ROLLOUT_RECOVERY_UNSETTLED','PROVIDER_OUTCOME_UNKNOWN',attestationHash);}
        if(provider.status==='ERROR'){diagnostic('RECOVERY_EXCEPTION');return result('ROLLOUT_RECOVERY_UNSETTLED','PROVIDER_OUTCOME_UNKNOWN',attestationHash);}
        if(provider.value==='PENDING')return result('ROLLOUT_RECOVERY_UNSETTLED','PROVIDER_PENDING',attestationHash);
        if(provider.value!=='APPLIED'&&provider.value!=='REJECTED'){diagnostic('RECOVERY_INVALID');return result('ROLLOUT_RECOVERY_UNSETTLED','PROVIDER_OUTCOME_INVALID',attestationHash);}
        const settlement=await settle(attestationHash,current,provider.value);
        if(settlement!=='SETTLED'){const conflict=settlement==='CONFLICT';diagnostic(conflict?'RECOVERY_JOURNAL_CONFLICT':'RECOVERY_JOURNAL_SETTLEMENT_FAILED');return result('ROLLOUT_RECOVERY_UNSETTLED',conflict?'RECOVERY_JOURNAL_CONFLICT':'RECOVERY_JOURNAL_SETTLEMENT_REQUIRED',attestationHash);}
        return provider.value==='APPLIED'?result('ROLLOUT_RECOVERY_APPLIED',null,attestationHash):result('ROLLOUT_RECOVERY_REJECTED','ACTIVATION_REJECTED',attestationHash);
      }finally{recovering.delete(attestationHash);}
    }
  });
}

module.exports=Object.freeze({RECOVERY_VERSION,EXPECTED_JOURNAL_VERSION,create});

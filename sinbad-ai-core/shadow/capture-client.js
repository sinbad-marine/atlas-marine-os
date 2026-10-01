'use strict';
// Capture client (Phase 4.3a, step A3): the pure part. It decides what may be sent, builds the request, runs the
// sequential capture loop and builds the capture records the A2 evaluator reads. Every effect is INJECTED: the transport
// (the only thing that can touch a network), the clock, the sleeper, the record writer, and the three functions that
// reproduce the web app's request (envelope builder, the server's envelope validator, the server's core decision).
// This module requires nothing that can reach a network or a file.
//
// Hard rules, in code:
//  - nothing is sent unless execution was asked for explicitly AND the call ceiling was confirmed twice; the default is a dry run;
//  - the endpoint must be https under supabase.co (loopback http only so tests and a local rehearsal never leave the machine),
//    so an access token can never be sent to an arbitrary host;
//  - one call per prompt, strictly sequential with spacing, no retry of any kind, no web search, no visual options;
//  - a ceiling smaller than the prompt list is refused, never silently truncated;
//  - the run stops on an authentication failure, a rate limit, a non-privileged caller or repeated errors;
//  - credentials exist only inside the transport call: they are never in a record, a plan, a summary or an error text,
//    and a response that echoes one is withheld.
const evaluator=require('./capture-evaluator');
const participation=require('../participation/participation-v0');

const VERSION='sinbad-shadow-capture-client/0-v1';
const MAX_CALLS=36;
const SUPABASE_HOST=/^[a-z0-9]{8,40}\.supabase\.co$/u;
const LOOPBACK_HOST=/^(?:127\.0\.0\.1|localhost)$/u;
const WORKSPACE_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
const RUN_ID=/^[A-Za-z0-9]{4,30}$/u;
const MAX_RESPONSE_CHARS=2*1024*1024;
const MAX_CONSECUTIVE_ERRORS=3;
const REQUEST_KEYS=Object.freeze(['workspaceId','question','language','coreEnvelope']);
const REQUEST_LANGUAGE=Object.freeze({en:'en-US',tr:'tr-TR'});
const ABORT_REASONS=Object.freeze(['AUTH_REJECTED','RATE_LIMITED','NOT_PRIVILEGED','TOO_MANY_ERRORS']);

const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const fail=(errors)=>({ok:false,errors,config:null});

// ---------- configuration ----------
// input: {url, publishableKey, accessToken, workspaceId, runId, maxCalls, execute, confirmCalls, spacingMs, timeoutMs}
function validateConfig(input){
  if(!isPlain(input))return fail(['CONFIG_NOT_AN_OBJECT']);
  const errors=[];
  let endpoint=null,host=null;
  try{
    const u=new URL(String(input.url));
    const loopback=u.protocol==='http:'&&LOOPBACK_HOST.test(u.hostname)&&u.port!=='';
    const cloud=u.protocol==='https:'&&SUPABASE_HOST.test(u.hostname)&&(u.port===''||u.port==='443');
    if(!loopback&&!cloud)errors.push('HOST_NOT_ALLOWED');
    else if(u.username||u.password||(u.pathname!==''&&u.pathname!=='/')||u.search||u.hash)errors.push('URL_NOT_AN_ORIGIN');
    else{endpoint=`${u.origin}/functions/v1/sinbad-answer`;host=u.host;}
  }catch{errors.push('URL_INVALID');}
  const secretOk=(v,min,max)=>typeof v==='string'&&v.length>=min&&v.length<=max&&!/\s/u.test(v);
  if(!secretOk(input.publishableKey,8,512))errors.push('PUBLISHABLE_KEY_INVALID');
  if(!secretOk(input.accessToken,20,4096))errors.push('ACCESS_TOKEN_INVALID');
  if(typeof input.workspaceId!=='string'||!WORKSPACE_ID.test(input.workspaceId))errors.push('WORKSPACE_ID_INVALID');
  if(typeof input.runId!=='string'||!RUN_ID.test(input.runId))errors.push('RUN_ID_INVALID');
  if(!Number.isSafeInteger(input.maxCalls)||input.maxCalls<1||input.maxCalls>MAX_CALLS)errors.push('MAX_CALLS_INVALID');
  if(typeof input.execute!=='boolean')errors.push('EXECUTE_INVALID');
  if(input.execute===true&&input.confirmCalls!==input.maxCalls)errors.push('CALL_CEILING_NOT_CONFIRMED');
  const spacingMs=input.spacingMs===undefined?1500:input.spacingMs,timeoutMs=input.timeoutMs===undefined?120_000:input.timeoutMs;
  if(!Number.isSafeInteger(spacingMs)||spacingMs<500||spacingMs>60_000)errors.push('SPACING_INVALID');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<5_000||timeoutMs>300_000)errors.push('TIMEOUT_INVALID');
  if(errors.length)return fail(errors);
  return {ok:true,errors:[],config:Object.freeze({endpoint,host,publishableKey:input.publishableKey,accessToken:input.accessToken,workspaceId:input.workspaceId,runId:input.runId,maxCalls:input.maxCalls,execute:input.execute,spacingMs,timeoutMs})};
}

// ---------- request ----------
// deps: {detectLanguage(question)->'en'|'tr', makeEnvelope(question,history), validateEnvelope(envelope,question)->bool}
// -> {ok, language, request:{endpoint, headers, body}} or {ok:false, reason}. `request` is for the transport only and is never stored.
function buildRequest(config,item,deps){
  if(!isPlain(item)||typeof item.prompt!=='string'||item.prompt.trim().length===0)return {ok:false,reason:'PROMPT_MISSING'};
  const language=deps.detectLanguage(item.prompt)==='tr'?'tr':'en';
  const envelope=deps.makeEnvelope(item.prompt,[]);
  if(deps.validateEnvelope(envelope,item.prompt)!==true)return {ok:false,reason:'ENVELOPE_INVALID',language};
  const body={workspaceId:config.workspaceId,question:item.prompt,language:REQUEST_LANGUAGE[language],coreEnvelope:envelope};
  if(Object.keys(body).join()!==REQUEST_KEYS.join())return {ok:false,reason:'REQUEST_SHAPE',language};
  return {ok:true,language,request:{endpoint:config.endpoint,headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.accessToken}`,apikey:config.publishableKey},body:JSON.stringify(body)}};
}

// ---------- records ----------
const scrub=(text,config)=>String(text).split(config.accessToken).join('[redacted]').split(config.publishableKey).join('[redacted]');
const carriesCredential=(text,config)=>text.includes(config.accessToken)||text.includes(config.publishableKey)||participation.secretFinding(text)!==null;
function recordOf(config,item,language,capturedAt,call){
  const base={version:evaluator.RECORD_VERSION,captureId:`cap-${config.runId}-${item.id}`,itemId:item.id,capturedAt,workspaceId:config.workspaceId,language};
  const status=Number.isSafeInteger(call.status)&&call.status>=0&&call.status<=599?call.status:0;
  const latencyMs=Number.isFinite(call.ms)&&call.ms>=0?Math.round(call.ms):null;
  const error=text=>scrub(text,config).slice(0,300);
  if(call.error)return {...base,httpStatus:status,latencyMs,response:null,error:error(call.error)};
  const text=typeof call.text==='string'?call.text:'';
  if(text.length>MAX_RESPONSE_CHARS)return {...base,httpStatus:status,latencyMs,response:null,error:'RESPONSE_TOO_LARGE'};
  // an answer that echoes a credential, or carries a secret-looking string, is not stored
  if(carriesCredential(text,config))return {...base,httpStatus:status,latencyMs,response:null,error:'RESPONSE_WITHHELD_CREDENTIAL_PATTERN'};
  let parsed=null;
  try{parsed=JSON.parse(text);}catch{return {...base,httpStatus:status,latencyMs,response:null,error:'RESPONSE_NOT_JSON'};}
  if(!isPlain(parsed))return {...base,httpStatus:status,latencyMs,response:null,error:'RESPONSE_NOT_AN_OBJECT'};
  return {...base,httpStatus:status,latencyMs,response:parsed,error:null};
}

// ---------- the run ----------
// items: [{id, category, prompt}]; deps adds {transport(request,{timeoutMs})->{status,text,ms,error}, now()->ms, sleep(ms)->Promise, write(record)}
// Never returns a prompt, response, credential or header: only counts, public item ids and reason codes.
async function runCapture({config,items,deps}){
  const out={version:VERSION,mode:config.execute?'EXECUTE':'DRY_RUN',endpointHost:config.host,runId:config.runId,ceiling:config.maxCalls,items:items.length,calls:0,written:0,byStatus:{},refused:null,aborted:null,plan:null};
  if(!Array.isArray(items)||items.length===0)return {...out,refused:'NO_ITEMS'};
  if(items.length>config.maxCalls)return {...out,refused:'ITEMS_EXCEED_CEILING'};
  const prepared=[];
  for(const item of items){
    const built=buildRequest(config,item,deps);
    let early=null;
    try{const d=deps.serverDecision(item.prompt);early=d&&(d.emergency||d.risk==='high'||d.risk==='critical')?'core-safety-blocked':null;}catch{early=null;}
    prepared.push({item,built,early});
  }
  if(!config.execute){
    return {...out,plan:prepared.map(p=>({itemId:p.item.id,category:p.item.category,language:p.built.language||null,envelope:p.built.ok?'VALID':p.built.reason,predictedEarlyExit:p.early}))};
  }
  let consecutiveErrors=0;
  for(let i=0;i<prepared.length;i+=1){
    const {item,built}=prepared[i];
    const capturedAt=deps.now();
    let call;
    if(!built.ok)call={status:0,text:'',ms:0,error:`NOT_SENT:${built.reason}`};
    else{
      if(out.calls>=config.maxCalls)return {...out,aborted:{reason:'CEILING_REACHED',itemId:item.id}};   // unreachable by construction; kept as a hard stop
      out.calls+=1;
      try{call=await deps.transport(built.request,{timeoutMs:config.timeoutMs});}catch{call={status:0,text:'',ms:0,error:'TRANSPORT_FAILED'};}
    }
    const record=recordOf(config,item,built.language||'en',capturedAt,call||{status:0,error:'NO_ANSWER'});
    const valid=evaluator.validateRecord(record);
    if(!valid.ok)return {...out,refused:`RECORD_INVALID:${valid.errors[0]}`};
    deps.write(record);out.written+=1;   // the plain record that was just validated
    const key=String(record.httpStatus);out.byStatus[key]=(out.byStatus[key]||0)+1;
    const failed=!built.ok||record.httpStatus!==200||record.response===null;
    if(built.ok)consecutiveErrors=failed?consecutiveErrors+1:0;
    let reason=null;
    if(record.httpStatus===401||record.httpStatus===403)reason='AUTH_REJECTED';
    else if(record.httpStatus===429)reason='RATE_LIMITED';
    else if(record.response&&Object.getOwnPropertyDescriptor(record.response,'sourceAccess')&&record.response.sourceAccess!=='privileged')reason='NOT_PRIVILEGED';
    else if(consecutiveErrors>=MAX_CONSECUTIVE_ERRORS)reason='TOO_MANY_ERRORS';
    if(reason)return {...out,aborted:{reason,itemId:item.id}};
    if(i<prepared.length-1&&built.ok)await deps.sleep(config.spacingMs);
  }
  return out;
}

module.exports=Object.freeze({VERSION,MAX_CALLS,REQUEST_KEYS,ABORT_REASONS,MAX_CONSECUTIVE_ERRORS,validateConfig,buildRequest,recordOf,runCapture});

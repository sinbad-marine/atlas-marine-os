'use strict';

const VERSION='0.2.0';
const MODE='LOCAL_MODEL_PROTOCOL_NO_IO';
const MAX_PROMPT_BYTES=32768;
const MAX_RESPONSE_BYTES=65536;
const MODEL_ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const ALLOWED_PATHS=new Set(['/api/generate','/v1/chat/completions','/v1/responses']);
const requests=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const clean=value=>String(value||'').normalize('NFC').replace(/[\u200B-\u200D\u2060\uFEFF]/gu,'').trim();

function validateEndpoint(input){
  let url;try{url=new URL(String(input||''));}catch(_){throw new TypeError('LOCAL_MODEL_ENDPOINT_INVALID');}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(host))throw new TypeError('LOOPBACK_HTTP_ENDPOINT_REQUIRED');
  if(url.username||url.password||url.search||url.hash||!url.port||!ALLOWED_PATHS.has(url.pathname))throw new TypeError('LOCAL_MODEL_ENDPOINT_SCOPE_INVALID');
  return url.toString();
}

function createRequest(input={}){
  const endpoint=validateEndpoint(input.endpoint),model=clean(input.model),instruction=clean(input.instruction),context=clean(input.context),responseFormat=input.responseFormat===undefined?'text':String(input.responseFormat);
  if(!MODEL_ID.test(model))throw new TypeError('LOCAL_MODEL_ID_INVALID');
  if(!instruction)throw new TypeError('LOCAL_MODEL_INSTRUCTION_REQUIRED');
  if(!['text','json'].includes(responseFormat))throw new TypeError('LOCAL_MODEL_RESPONSE_FORMAT_INVALID');
  if(Buffer.byteLength(instruction,'utf8')>MAX_PROMPT_BYTES||Buffer.byteLength(context,'utf8')>MAX_PROMPT_BYTES)throw new RangeError('LOCAL_MODEL_PROMPT_TOO_LARGE');
  const request=freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_REQUEST_READY',endpoint,model,instruction,context,responseFormat,systemBoundary:'Return a draft only. Do not claim execution, publication, network access, Core modification, or approval.',limits:{maxPromptBytes:MAX_PROMPT_BYTES,maxResponseBytes:MAX_RESPONSE_BYTES},io:{performed:false,network:false,commands:false},nextGate:'EXPLICIT_LOOPBACK_TRANSPORT_AUTHORIZATION'});
  requests.add(request);return request;
}

function extractText(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new TypeError('LOCAL_MODEL_RESPONSE_INVALID');
  if(typeof payload.response==='string')return payload.response;
  if(typeof payload.output_text==='string')return payload.output_text;
  const choice=payload.choices&&payload.choices[0];
  if(choice&&choice.message&&typeof choice.message.content==='string')return choice.message.content;
  throw new TypeError('LOCAL_MODEL_TEXT_MISSING');
}

function parseResponse(request,payload){
  if(!request||!requests.has(request)||request.status!=='LOCAL_MODEL_REQUEST_READY')throw new TypeError('AUTHENTIC_REQUEST_REQUIRED');
  const text=clean(extractText(payload));
  if(!text)throw new TypeError('LOCAL_MODEL_TEXT_EMPTY');
  if(Buffer.byteLength(text,'utf8')>MAX_RESPONSE_BYTES)throw new RangeError('LOCAL_MODEL_RESPONSE_TOO_LARGE');
  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text))throw new TypeError('LOCAL_MODEL_RESPONSE_CONTROL_CHARACTER');
  return freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_DRAFT_UNTRUSTED',model:request.model,text,authority:'DATA_ONLY',claims:{executed:false,published:false,networkVerified:false,coreModified:false,approved:false},io:{performed:false,network:false,commands:false},nextGate:'STUDIO_DRAFT_SCHEMA_AND_STATIC_POLICY_VALIDATION'});
}

const isAuthenticRequest=value=>Boolean(value&&requests.has(value));
module.exports=freeze({VERSION,MODE,MAX_PROMPT_BYTES,MAX_RESPONSE_BYTES,ALLOWED_PATHS,validateEndpoint,createRequest,parseResponse,isAuthenticRequest});

'use strict';
const protocol=require('./local-model-protocol.js');

const VERSION='0.2.0';
const MODE='AUTHORIZED_LOOPBACK_MODEL_GATEWAY';
const MAX_TTL_MS=2*60*1000;
const MAX_TIMEOUT_MS=30*1000;
const MAX_WIRE_BYTES=protocol.MAX_RESPONSE_BYTES+8192;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(options={}){
  const transport=options.transport;
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const grants=new WeakMap(),grantObjects=new WeakSet();

  function authorize(request,input={}){
    if(!protocol.isAuthenticRequest(request))throw new TypeError('authentic local model request required');
    const approvedBy=String(input.approvedBy||''),purpose=String(input.purpose||''),nonce=String(input.nonce||'');
    if(!ID.test(approvedBy)||!ID.test(purpose)||!ID.test(nonce))throw new TypeError('bounded approval identity purpose and nonce are required');
    const now=Number(clock()),expiresAt=Number(input.expiresAt),timeoutMs=Number(input.timeoutMs);
    if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+MAX_TTL_MS)throw new RangeError('loopback authorization expiry is invalid');
    if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>MAX_TIMEOUT_MS)throw new RangeError('loopback timeout is invalid');
    const authorization=freeze({version:VERSION,mode:MODE,approvedBy,purpose,nonce,endpoint:request.endpoint,model:request.model,expiresAt,timeoutMs,scope:'ONE_LOOPBACK_MODEL_DRAFT'});
    grants.set(authorization,{request,consumed:false});grantObjects.add(authorization);return authorization;
  }

  async function send(request,authorization){
    const grant=authorization&&grantObjects.has(authorization)?grants.get(authorization):null;
    if(!grant||grant.request!==request||grant.consumed)throw new Error('LOOPBACK_MODEL_NOT_AUTHORIZED');
    grant.consumed=true;
    if(Number(clock())>=authorization.expiresAt)throw new Error('LOOPBACK_MODEL_AUTHORIZATION_EXPIRED');
    if(!protocol.isAuthenticRequest(request))throw new Error('LOCAL_MODEL_REQUEST_INVALID');
    if(typeof transport!=='function')throw new Error('LOOPBACK_TRANSPORT_NOT_CONFIGURED');
    const endpoint=protocol.validateEndpoint(request.endpoint),controller=new AbortController();
    const body=endpoint.includes('/api/generate')?{model:request.model,prompt:`${request.systemBoundary}\n\n${request.context}\n\n${request.instruction}`,stream:false}:{model:request.model,messages:[{role:'system',content:request.systemBoundary},{role:'user',content:`${request.context}\n\n${request.instruction}`}]};
    let timer;
    try{
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('LOOPBACK_MODEL_TIMEOUT'));},authorization.timeoutMs);});
      const transportInput=Object.freeze({url:endpoint,method:'POST',headers:Object.freeze({'content-type':'application/json'}),body:JSON.stringify(body),signal:controller.signal,maxResponseBytes:MAX_WIRE_BYTES});
      const response=await Promise.race([Promise.resolve().then(()=>transport(transportInput)),timeout]);
      if(!response||response.statusCode!==200)throw new Error('LOOPBACK_MODEL_HTTP_FAILURE');
      const wire=Buffer.isBuffer(response.body)?response.body:Buffer.from(String(response.body||''),'utf8');
      if(wire.length>MAX_WIRE_BYTES)throw new Error('LOOPBACK_MODEL_WIRE_RESPONSE_TOO_LARGE');
      let payload;try{payload=JSON.parse(wire.toString('utf8'));}catch(_){throw new Error('LOOPBACK_MODEL_JSON_INVALID');}
      const draft=protocol.parseResponse(request,payload);
      return freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_DRAFT_RECEIVED_UNTRUSTED',model:draft.model,text:draft.text,authority:'DATA_ONLY',claims:draft.claims,io:{performed:true,network:'LOOPBACK_ONLY',commands:false},nextGate:draft.nextGate});
    }finally{if(timer)clearTimeout(timer);}
  }
  return freeze({VERSION,MODE,authorize,send});
}

module.exports=freeze({VERSION,MODE,MAX_TTL_MS,MAX_TIMEOUT_MS,MAX_WIRE_BYTES,create});

'use strict';
// Read-only client for the CURRENT Sinbad Bridge (bridge/sinbad-bridge.ps1) as it exists.
// It sends exactly the ARGOS command envelope the production browser surfaces send
// (see academy-classroom-window.js argosBridgeHeaders) and never touches any other route.
const crypto=require('node:crypto');
const http=require('node:http');

const DEFAULT_URL='http://127.0.0.1:31983';
const VERSION='sinbad-argos-command/1-v1';
const ACTIONS=Object.freeze({'/ai/chat':'AI_INFERENCE'});
const COMMAND_ID=/^[A-Za-z0-9._-]{16,120}$/u;
const REQUESTED_AT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function envelope(target='/ai/chat',overrides={}){
  const headers={
    'X-Sinbad-Argos-Version':VERSION,
    'X-Sinbad-Argos-Action':ACTIONS[target]||'AI_INFERENCE',
    'X-Sinbad-Argos-Target':target,
    'X-Sinbad-Argos-Command-Id':`benchmark-${crypto.randomUUID()}`,
    'X-Sinbad-Argos-Requested-At':new Date().toISOString(),
    ...overrides
  };
  for(const key of Object.keys(headers))if(headers[key]===undefined)delete headers[key];
  return headers;
}
function envelopeIsValid(headers){
  return headers['X-Sinbad-Argos-Version']===VERSION&&COMMAND_ID.test(String(headers['X-Sinbad-Argos-Command-Id']||''))&&REQUESTED_AT.test(String(headers['X-Sinbad-Argos-Requested-At']||''))&&ACTIONS[headers['X-Sinbad-Argos-Target']]===headers['X-Sinbad-Argos-Action'];
}

// node:http instead of fetch: undici's default 300 s headers timeout would cut off genuine
// multi-minute bridge answers with "fetch failed" and hide the true latency.
function request(method,path,body,options={}){
  const url=new URL((options.baseUrl||DEFAULT_URL)+path);
  const payload=body===undefined||body===null?null:(typeof body==='string'?body:JSON.stringify(body));
  const timeoutMs=options.timeoutMs||240000;
  const started=process.hrtime.bigint();
  const elapsed=()=>Number(process.hrtime.bigint()-started)/1e6;
  return new Promise(resolve=>{
    let settled=false;
    const finish=result=>{if(!settled){settled=true;resolve(Object.freeze({rawLength:0,data:null,error:null,...result,elapsedMs:elapsed()}));}};
    const headers={Accept:'application/json',...(options.headers||{})};
    if(payload!==null){headers['Content-Type']=headers['Content-Type']||'application/json';headers['Content-Length']=Buffer.byteLength(payload);}
    const req=http.request({host:url.hostname,port:url.port,path:url.pathname+url.search,method,headers,agent:false},res=>{
      let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;});
      res.on('end',()=>{let data=null;try{data=JSON.parse(text);}catch{data=null;}finish({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,data,rawLength:text.length});});
      res.on('error',error=>finish({ok:false,status:res.statusCode||0,error:String(error?.message||error)}));
    });
    req.setTimeout(timeoutMs,()=>{req.destroy(new Error('CLIENT_TIMEOUT'));});
    req.on('error',error=>finish({ok:false,status:0,error:error?.message==='CLIENT_TIMEOUT'?'CLIENT_TIMEOUT':String(error?.message||error)}));
    if(payload!==null)req.write(payload);
    req.end();
  });
}
async function post(path,body,options={}){
  const headers={'Content-Type':'application/json',...(options.headers||envelope(path,options.envelope))};
  return request('POST',path,body,{...options,headers});
}

// The bridge reads question, history and depth from the /ai/chat payload; language is accepted but unused there.
async function ask(question,options={}){
  const body={question:String(question),history:Array.isArray(options.history)?options.history:[],language:options.language||'en-US'};
  if(options.depth)body.depth=options.depth;
  return post('/ai/chat',body,options);
}

async function getJson(path,options={}){
  const result=await request('GET',path,null,{...options,timeoutMs:options.timeoutMs||8000});
  return {ok:result.ok,status:result.status,data:result.data,error:result.error};
}

module.exports=Object.freeze({DEFAULT_URL,VERSION,ACTIONS,envelope,envelopeIsValid,request,post,ask,getJson});

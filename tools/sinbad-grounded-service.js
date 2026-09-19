#!/usr/bin/env node
'use strict';
// Project 2 Phase 4.6 - loopback host for the grounded pipeline (measurement service, not a product surface).
// It speaks the same /ai/chat contract as the Sinbad Bridge so that the benchmark tooling can point at it,
// but it is a separate process on its own port: it never touches the bridge, its port 31983, its files or
// any ARGOS-protected file. It reads the library index the bridge already built (read only), asks the local
// model through Ollama on the loopback interface, and gates every draft with the accepted inert chain.
// Loopback only, no outbound network, no cloud. Run:
//   node tools/sinbad-grounded-service.js [--port 31990] [--index <path to .sinbad-index.json>] [--model qwen3:14b]
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {pipeline,retriever,MANIFEST}=require('../sinbad-ai-core/pipeline');

const DEFAULT_INDEX=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const HOST='127.0.0.1',MAX_BODY_BYTES=64*1024,MODEL_TIMEOUT_MS=15*60*1000;
// The host is the Owner's working machine. Below this much free memory no model call is started (503 HOST_MEMORY_LOW).
const DEFAULT_MIN_FREE_GB=1.5;
function parseArgs(argv){
  const args={port:31990,index:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_INDEX,model:'qwen3:14b',ollama:'http://127.0.0.1:11434',passages:6,predict:320,minFreeGb:DEFAULT_MIN_FREE_GB};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];
    if(a==='--port'){args.port=Number(v);i+=1;}else if(a==='--index'){args.index=v;i+=1;}else if(a==='--model'){args.model=v;i+=1;}else if(a==='--ollama'){args.ollama=v;i+=1;}else if(a==='--passages'){args.passages=Number(v);i+=1;}else if(a==='--predict'){args.predict=Number(v);i+=1;}else if(a==='--min-free-gb'){args.minFreeGb=Number(v);i+=1;}}
  const target=new URL(args.ollama);
  if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname))throw new Error('OLLAMA_MUST_BE_LOOPBACK');
  if(!Number.isInteger(args.port)||args.port===31983||args.port<1024||args.port>65535)throw new Error('PORT_INVALID');
  if(!Number.isFinite(args.minFreeGb)||args.minFreeGb<0.5)throw new Error('MIN_FREE_GB_INVALID');
  return args;
}
function ollamaChat(args,messages){
  const target=new URL('/api/chat',args.ollama);
  // use_mmap:false - measured on this host: llama.cpp repacks the weights for the CPU (6.0 GB) while the memory-mapped file
  // stays in the working set too; without mapping the model server holds 9.95 GB instead of 15.4 GB.
  const body=JSON.stringify({model:args.model,stream:false,think:false,keep_alive:'30m',options:{temperature:0,num_ctx:8192,num_predict:args.predict,use_mmap:false},messages});
  return new Promise((resolve,reject)=>{
    const req=http.request({host:target.hostname,port:target.port||80,path:target.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:MODEL_TIMEOUT_MS},res=>{
      let data='';res.setEncoding('utf8');res.on('data',d=>{data+=d;});res.on('end',()=>{try{const j=JSON.parse(data);if(res.statusCode!==200)return reject(new Error(`OLLAMA_HTTP_${res.statusCode}`));resolve({text:String(j.message?.content||''),model:String(j.model||args.model)});}catch{reject(new Error('OLLAMA_RESPONSE_INVALID'));}});
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('OLLAMA_TIMEOUT')));req.end(body);
  });
}
// Measured on this host: the model server keeps every prompt in a prompt cache (about 380 MB each), so it grew from 9.95 GB
// to 12.8 GB within four questions and the host's memory guard stopped the run. The model is therefore unloaded after every
// question (keep_alive 0): the cache goes with it and the footprint stays bounded; the price is a reload of about 15 s.
function ollamaUnload(args){
  const target=new URL('/api/generate',args.ollama);const body=JSON.stringify({model:args.model,keep_alive:0});
  return new Promise(resolve=>{const req=http.request({host:target.hostname,port:target.port||80,path:target.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:60_000},res=>{res.resume();res.on('end',resolve);});req.on('error',resolve);req.on('timeout',()=>{req.destroy();resolve();});req.end(body);});
}
const send=(res,status,body)=>{const text=JSON.stringify(body);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(text),'Cache-Control':'no-store'});res.end(text);};

function main(){
  const args=parseArgs(process.argv.slice(2));
  process.stdout.write(`loading library index ${args.index}\n`);
  const loaded=Date.now();let raw=JSON.parse(fs.readFileSync(args.index,'utf8').replace(/^﻿/u,''));
  const index=retriever.build(raw.documents||[]);
  const builtAt=raw.builtAt;raw=null;
  process.stdout.write(`index: ${index.documentCount} documents, ${index.chunks.length} chunks, built ${builtAt}, ready in ${((Date.now()-loaded)/1000).toFixed(1)} s\n`);
  let counter=0;let queue=Promise.resolve();
  const server=http.createServer((req,res)=>{
    if(req.method==='GET'&&req.url==='/status')return send(res,200,{name:'Sinbad Grounded Service',component:MANIFEST.version,pipeline:pipeline.VERSION,retriever:retriever.VERSION,model:args.model,library:{documents:index.documentCount,chunks:index.chunks.length,builtAt},host:{freeGb:Number((os.freemem()/2**30).toFixed(1)),minFreeGb:args.minFreeGb},loopbackOnly:true,product:false});
    if(req.method!=='POST'||req.url!=='/ai/chat')return send(res,404,{error:'NOT_FOUND'});
    const parts=[];let size=0;
    req.on('data',d=>{size+=d.length;if(size>MAX_BODY_BYTES){send(res,413,{error:'BODY_TOO_LARGE'});req.destroy();}else parts.push(d);});
    req.on('end',()=>{
      let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return send(res,400,{error:'BODY_INVALID'});}
      const question=typeof body?.question==='string'?body.question:'';if(!question.trim())return send(res,400,{error:'QUESTION_REQUIRED'});
      if(os.freemem()<args.minFreeGb*2**30)return send(res,503,{error:'HOST_MEMORY_LOW',freeGb:Number((os.freemem()/2**30).toFixed(1))});
      counter+=1;const requestId=`grounded-${loaded}-${counter}`;
      // One request at a time: a CPU-only 14B model gains nothing from concurrency.
      queue=queue.then(async()=>{
        const started=Date.now();
        const result=await pipeline.answer({question,index,requestId,now:()=>Date.now(),passageLimit:args.passages,generate:messages=>ollamaChat(args,messages)});
        send(res,200,{answer:pipeline.render(result),modelText:result.answer,model:result.model||args.model,modelTier:'grounded',mode:'grounded-gated',
          knowledge:{state:result.sources.length?'LIBRARY':'NO_MATCH',results:result.sources.length,reason:result.reasonCode},
          routing:{pipeline:pipeline.VERSION,iterations:result.iterations,delivery:result.delivery},
          gate:{delivery:result.delivery,outcome:result.outcome,reasonCode:result.reasonCode,labels:result.labels,iterations:result.iterations,record:pipeline.gateRecord(result),drafts:result.drafts},
          sources:result.sources,transcript:body.includeTranscript===true?result.transcript:undefined,elapsedMs:Date.now()-started});
        await ollamaUnload(args);
      }).catch(()=>send(res,500,{error:'INTERNAL'}));
    });
  });
  server.listen(args.port,HOST,()=>process.stdout.write(`grounded service on http://${HOST}:${args.port} (model ${args.model}; loopback only; not the bridge)\n`));
}
if(require.main===module)main();
module.exports={parseArgs,DEFAULT_INDEX};

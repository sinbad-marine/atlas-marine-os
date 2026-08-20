(function(root,factory){
  const studio=typeof module==='object'&&module.exports?require('./studio-engine.js'):root.SinbadStudioEngine;
  const api=factory(studio);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadStudioVirtualArtifacts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(studio){
  'use strict';

  const VERSION='0.1.0';
  const MODE='VIRTUAL_ONLY';
  const MAX_ARTIFACTS=16;
  const MAX_TOTAL_BYTES=262144;
  const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const html=value=>String(value).replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const json=value=>JSON.stringify(value,null,2)+'\n';
  const artifact=(path,mediaType,content)=>Object.freeze({path,mediaType,content:String(content),bytes:Buffer.byteLength(String(content),'utf8')});

  function webArtifacts(plan){
    const title=html(plan.project.name),brief=html(plan.instruction);
    return [
      artifact('web/index.html','text/html; charset=utf-8',`<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>${title}</h1><p>${brief}</p><button id="studio-action" type="button">Başla</button><output id="studio-status" aria-live="polite"></output></main><script src="app.js"></script></body></html>\n`),
      artifact('web/styles.css','text/css; charset=utf-8',`:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#061923;color:#f4f7fb}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center}main{width:min(720px,calc(100% - 2rem));padding:2rem;border:1px solid #315468;border-radius:1rem}button{padding:.75rem 1rem}\n`),
      artifact('web/app.js','text/javascript; charset=utf-8',`'use strict';\ndocument.querySelector('#studio-action').addEventListener('click',()=>{document.querySelector('#studio-status').textContent='Yerel taslak hazır. Yayın yapılmadı.';});\n`)
    ];
  }
  function softwareArtifacts(plan){
    return [
      artifact('software/README.md','text/markdown; charset=utf-8',`# ${plan.project.name}\n\n${plan.instruction}\n\nGenerated as a virtual, offline-only Studio draft. No command was executed.\n`),
      artifact('software/src/index.js','text/javascript; charset=utf-8',`'use strict';\nfunction describe(){return ${JSON.stringify({name:plan.project.name,mode:'SANDBOX_ONLY'})};}\nmodule.exports={describe};\n`),
      artifact('software/tests/index.test.js','text/javascript; charset=utf-8',`const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst app=require('../src/index.js');\ntest('remains sandbox only',()=>assert.equal(app.describe().mode,'SANDBOX_ONLY'));\n`)
    ];
  }
  function animationArtifacts(plan){
    return [
      artifact('animation/storyboard.json','application/json; charset=utf-8',json({version:1,title:plan.project.name,brief:plan.instruction,scenes:[{id:'scene-1',durationMs:3000,purpose:'opening'},{id:'scene-2',durationMs:3000,purpose:'explanation'}],renderAuthority:'PREVIEW_ONLY'})),
      artifact('animation/preview.svg','image/svg+xml; charset=utf-8',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc"><title id="title">${html(plan.project.name)}</title><desc id="desc">${html(plan.instruction)}</desc><rect width="1280" height="720" fill="#061923"/><circle cx="640" cy="360" r="96" fill="#54dbc2"><animate attributeName="r" values="80;110;80" dur="3s" repeatCount="indefinite"/></circle></svg>\n`)
    ];
  }
  function compile(input={}){
    const plan=studio.plan(input);
    if(plan.status!=='STUDIO_PLAN_READY')return freeze({version:VERSION,mode:MODE,status:'VIRTUAL_ARTIFACTS_BLOCKED',plan,artifacts:[],reason:plan.status,io:{filesystem:false,network:false,commands:false}});
    const artifacts=plan.domains.flatMap(domain=>domain==='web'?webArtifacts(plan):domain==='software'?softwareArtifacts(plan):animationArtifacts(plan));
    const totalBytes=artifacts.reduce((sum,item)=>sum+item.bytes,0);
    if(artifacts.length>MAX_ARTIFACTS||totalBytes>MAX_TOTAL_BYTES)return freeze({version:VERSION,mode:MODE,status:'VIRTUAL_ARTIFACTS_BLOCKED',plan,artifacts:[],reason:'ARTIFACT_LIMIT_EXCEEDED',io:{filesystem:false,network:false,commands:false}});
    return freeze({version:VERSION,mode:MODE,status:'VIRTUAL_ARTIFACTS_READY',plan,artifacts,totalBytes,io:{filesystem:false,network:false,commands:false},nextGate:'EXPLICIT_SANDBOX_WRITE_AUTHORIZATION'});
  }
  return freeze({VERSION,MODE,MAX_ARTIFACTS,MAX_TOTAL_BYTES,compile});
});

'use strict';
const crypto=require('node:crypto');
const vm=require('node:vm');
const path=require('node:path');
const compiler=require('./virtual-artifact-compiler.js');

const VERSION='0.1.0';
const MODE='STATIC_VERIFY_ONLY';
const TYPE_BY_EXTENSION=Object.freeze({
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.md':'text/markdown; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml; charset=utf-8'
});
const reports=new WeakSet();
const SAFE_TEST_MODULES=new Set(['node:test','node:assert','node:assert/strict']);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const issue=(code,detail='')=>Object.freeze({code,detail:String(detail)});

function inspectArtifact(artifact){
  const issues=[];
  if(!artifact||typeof artifact!=='object')return Object.freeze([issue('ARTIFACT_INVALID')]);
  const extension=path.posix.extname(String(artifact.path||'')).toLowerCase(),expectedType=TYPE_BY_EXTENSION[extension];
  if(!expectedType||artifact.mediaType!==expectedType)issues.push(issue('MEDIA_TYPE_MISMATCH',extension||'none'));
  const content=String(artifact.content||'');
  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(content))issues.push(issue('UNSAFE_CONTROL_CHARACTER'));
  const remoteScan=content.replace(/http:\/\/www\.w3\.org\/2000\/svg/giu,'');
  if(/(?:https?:|wss?:|ftp:|\/\/[A-Za-z0-9.-]+\.)/iu.test(remoteScan))issues.push(issue('EXTERNAL_REFERENCE_FORBIDDEN'));
  if(extension==='.js'){
    if(/(?:child_process|process\.binding|process\.dlopen|\bDeno\.|\bBun\.|\beval\s*\(|new\s+Function\b|\bfetch\s*\(|\bWebSocket\b|\bEventSource\b)/u.test(content))issues.push(issue('ACTIVE_CODE_CAPABILITY_FORBIDDEN'));
    for(const match of content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu))if(!match[1].startsWith('./')&&!match[1].startsWith('../')&&!SAFE_TEST_MODULES.has(match[1]))issues.push(issue('NONLOCAL_MODULE_FORBIDDEN',match[1]));
    try{new vm.Script(content,{filename:String(artifact.path),displayErrors:false});}catch(_){issues.push(issue('JAVASCRIPT_SYNTAX_INVALID'));}
  }
  if(extension==='.html'&&(/<\s*\/?\s*(?:iframe|object|embed|base|form)\b|\son[a-z]+\s*=|javascript\s*:/iu.test(content)||/<meta\b[^>]*http-equiv\s*=\s*['"]?refresh/iu.test(content)))issues.push(issue('HTML_ACTIVE_CONTENT_FORBIDDEN'));
  if(extension==='.svg'&&/<\s*\/?\s*(?:script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|(?:href|xlink:href)\s*=\s*['"](?!#)/iu.test(content))issues.push(issue('SVG_ACTIVE_CONTENT_FORBIDDEN'));
  if(extension==='.css'&&/(?:@import|url\s*\(\s*['"]?\s*(?:https?:|\/\/|data:))/iu.test(content))issues.push(issue('CSS_EXTERNAL_CONTENT_FORBIDDEN'));
  if(extension==='.json')try{JSON.parse(content);}catch(_){issues.push(issue('JSON_SYNTAX_INVALID'));}
  return Object.freeze(issues);
}

function verify(bundle){
  if(!compiler.isAuthenticBundle(bundle)||bundle.status!=='VIRTUAL_ARTIFACTS_READY')return freeze({version:VERSION,mode:MODE,status:'STATIC_PREVIEW_BLOCKED',reason:'AUTHENTIC_BUNDLE_REQUIRED',issues:[],manifest:[],io:{filesystem:false,network:false,commands:false,render:false}});
  const findings=[],manifest=[];
  for(const artifact of bundle.artifacts){
    const issues=inspectArtifact(artifact);
    for(const item of issues)findings.push(Object.freeze({path:artifact.path,...item}));
    manifest.push(Object.freeze({path:artifact.path,mediaType:artifact.mediaType,bytes:artifact.bytes,sha256:sha256(Buffer.from(artifact.content,'utf8'))}));
  }
  manifest.sort((a,b)=>a.path.localeCompare(b.path));
  if(findings.length)return freeze({version:VERSION,mode:MODE,status:'STATIC_PREVIEW_BLOCKED',reason:'STATIC_POLICY_VIOLATION',issues:findings,manifest:[],io:{filesystem:false,network:false,commands:false,render:false}});
  const manifestHash=sha256(Buffer.from(JSON.stringify(manifest),'utf8'));
  const report=freeze({version:VERSION,mode:MODE,status:'STATIC_PREVIEW_READY',projectSlug:bundle.plan.project.slug,manifest:Object.freeze(manifest),manifestHash,entrypoints:Object.freeze(bundle.plan.domains.map(domain=>domain==='web'?'web/index.html':domain==='software'?'software/README.md':'animation/preview.svg')),io:{filesystem:false,network:false,commands:false,render:false},nextGate:'SANDBOX_PERSISTENCE_OR_LOCAL_PREVIEW_AUTHORIZATION'});
  reports.add(report);return report;
}
const isAuthenticReport=value=>Boolean(value&&reports.has(value));
module.exports=freeze({VERSION,MODE,TYPE_BY_EXTENSION,inspectArtifact,verify,isAuthenticReport});

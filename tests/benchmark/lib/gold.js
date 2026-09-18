'use strict';
// Gold dataset loader and provenance validation. Maritime anchors must be verbatim substrings of the
// verified source text in docs/academy/*-master-source-manifest/*.json (normalized whitespace/case);
// nothing in the gold set is derived from model output.
const fs=require('node:fs');
const path=require('node:path');
const {normalize}=require('./scoring');

const ROOT=path.resolve(__dirname,'..','..','..');
const QUESTIONS=path.join(__dirname,'..','questions');
const CATEGORIES=Object.freeze(['maritime-reasoning','coding','repo-state','context-isolation','stale-state','contradiction','provenance-citation','hallucination','failure-handling','multi-agent','recovery','reliability']);

function load(category){
  const file=path.join(QUESTIONS,`${category}.json`);
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(data.items))throw new Error(`${category}: items[] required`);
  return data;
}
function loadAll(){const out={};for(const category of CATEGORIES)out[category]=load(category);return out;}

function collectSources(value,out=[]){
  if(Array.isArray(value)){for(const item of value)collectSources(item,out);}
  else if(value&&typeof value==='object'){if(typeof value.sourceId==='string'&&typeof value.fullText==='string')out.push(value);for(const key of Object.keys(value))if(key!=='fullText')collectSources(value[key],out);}
  return out;
}
let sourceCache=null;
function verifiedSources(){
  if(sourceCache)return sourceCache;
  const index=new Map();
  for(const dir of ['ism-master-source-manifest','isps-master-source-manifest','mlc-master-source-manifest']){
    const folder=path.join(ROOT,'docs','academy',dir);
    for(const name of fs.readdirSync(folder).filter(f=>/^PILOT-\d{3}\.json$/u.test(f)).sort()){
      const manifest=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
      for(const source of collectSources(manifest)){if(!index.has(source.sourceId))index.set(source.sourceId,{...source,manifestFile:`docs/academy/${dir}/${name}`});}
    }
  }
  sourceCache=index;return index;
}
function anchorIsVerbatim(sourceId,phrase){
  const source=verifiedSources().get(sourceId);
  if(!source)return {ok:false,reason:`unknown sourceId ${sourceId}`};
  return normalize(source.fullText).includes(normalize(phrase))?{ok:true,manifestFile:source.manifestFile}:{ok:false,reason:`phrase not verbatim in ${sourceId}: ${phrase}`};
}
function validateMaritime(data){
  const problems=[];
  for(const item of data.items){
    if(!item.id||!item.sourceId||!Array.isArray(item.anchorGroups)||!item.anchorGroups.length)problems.push(`${item.id||'?'}: id, sourceId and anchorGroups required`);
    for(const group of item.anchorGroups||[])for(const phrase of group){const check=anchorIsVerbatim(item.sourceId,phrase);if(!check.ok)problems.push(`${item.id}: ${check.reason}`);}
  }
  return problems;
}
module.exports=Object.freeze({ROOT,QUESTIONS,CATEGORIES,load,loadAll,verifiedSources,anchorIsVerbatim,validateMaritime});

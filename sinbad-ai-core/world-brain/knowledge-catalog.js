'use strict';

const packContract=require('./knowledge-pack.js');
const router=require('./topic-router.js');
const freshness=require('./freshness-policy.js');

const VERSION='sinbad-knowledge-catalog/1';

function create(options={}){
  const now=typeof options.now==='function'?options.now:()=>new Date().toISOString();
  const installed=new Map();

  function install(manifest,bytes){
    if(!Buffer.isBuffer(bytes))throw new TypeError('knowledge pack bytes are required');
    const validation=packContract.validate(manifest);
    const actualHash=packContract.contentHash(bytes);
    if(actualHash!==validation.pack.contentHash){
      const error=new Error('knowledge pack content hash mismatch');error.code='PACK_HASH_MISMATCH';throw error;
    }
    const existing=installed.get(validation.pack.packId);
    if(existing){
      if(existing.pack.contentHash!==actualHash){const error=new Error('pack ID already belongs to different content');error.code='PACK_ID_CONFLICT';throw error;}
      return Object.freeze({status:'ALREADY_INSTALLED',record:existing});
    }
    const record=Object.freeze({pack:validation.pack,installedAt:now(),byteLength:bytes.length});
    installed.set(validation.pack.packId,record);
    return Object.freeze({status:'INSTALLED',record});
  }

  function remove(){
    const error=new Error('knowledge pack removal requires a separate owner-approved lifecycle');error.code='PACK_REMOVAL_NOT_AUTHORIZED';throw error;
  }

  function snapshot(){
    return Object.freeze({version:VERSION,createdAt:now(),packs:Object.freeze([...installed.values()].sort((a,b)=>a.pack.packId.localeCompare(b.pack.packId)))});
  }

  function plan(question,input={}){
    const domains=router.route(question,{limit:input.domainLimit||3});
    const candidates=[];
    for(const record of installed.values()){
      const routeMatch=domains.find(item=>item.domain.id===record.pack.domain);if(!routeMatch)continue;
      const state=freshness.evaluate({freshness:routeMatch.domain.freshness,snapshotDate:record.pack.snapshotDate,now:input.now||now()});
      candidates.push(Object.freeze({record,domain:routeMatch.domain,routeScore:routeMatch.score,freshness:state,eligible:state.usable}));
    }
    candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.routeScore-a.routeScore||a.record.pack.packId.localeCompare(b.record.pack.packId));
    return Object.freeze({version:VERSION,question:String(question),domains,candidates:Object.freeze(candidates),eligible:Object.freeze(candidates.filter(item=>item.eligible)),requiresLiveSource:candidates.some(item=>item.freshness.status===freshness.STATES.LIVE_REQUIRED)});
  }

  return Object.freeze({version:VERSION,install,remove,snapshot,plan});
}

module.exports=Object.freeze({VERSION,create});

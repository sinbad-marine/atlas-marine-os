'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('const ENGINE_ROOM_STATES');
const end=source.indexOf('let engineRoomRequest');
const context={};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
const normalize=probes=>JSON.parse(JSON.stringify(context.normalizeEngineRoomSnapshot(probes,'T')));
const fail={ok:false,body:null};
const bridgeState=probes=>normalize(probes).engines.find(engine=>engine.id==='bridge').state;

test('Bridge is UNKNOWN when bridge.online is absent even if /status answers',()=>{
  assert.equal(bridgeState({
    argos:{ok:true,body:{state:'ACTIVE',mode:'MONITOR_ONLY',commandGate:{active:true}}},
    status:{ok:true,body:{name:'Sinbad Bridge',version:'0.5.0',routes:3}},
    library:fail,studio:fail,ai:fail
  }),'UNKNOWN');
});

test('Bridge truth table does not treat an HTTP answer as RUNNING',()=>{
  assert.equal(bridgeState({
    argos:{ok:true,body:{bridge:{online:true,version:'0.5.0'}}},
    status:fail,library:fail,studio:fail,ai:fail
  }),'RUNNING');
  assert.equal(bridgeState({
    argos:{ok:true,body:{bridge:{online:false}}},
    status:{ok:true,body:{name:'Sinbad Bridge',version:'0.5.0',routes:1}},
    library:fail,studio:fail,ai:fail
  }),'OFFLINE');
  assert.equal(bridgeState({
    argos:{ok:true,body:{bridge:{online:'true'}}},
    status:{ok:true,body:{name:'Sinbad Bridge',version:'0.5.0'}},
    library:fail,studio:fail,ai:fail
  }),'UNKNOWN');
  assert.equal(bridgeState({
    argos:fail,
    status:{ok:true,body:{name:'Sinbad Bridge',version:'0.5.0',routes:0,library:{documents:0,chunks:0}}},
    library:fail,studio:fail,ai:fail
  }),'UNKNOWN');
  assert.equal(bridgeState({argos:fail,status:fail,library:fail,studio:fail,ai:fail}),'UNAVAILABLE');
});

test('one slow or failed probe does not discard the other probes',async()=>{
  const calls=[];
  const probes=await context.collectEngineRoomProbes(async path=>{
    calls.push(path);
    if(path==='/ai/status'){
      await new Promise(resolve=>setTimeout(resolve,30));
      return {ok:true,http:200,body:{online:false,model:'qwen3:14b',installed:false,models:[]}};
    }
    if(path==='/status')throw new Error('status down');
    if(path==='/argos/status')return {ok:true,http:200,body:{bridge:{online:true,version:'0.5.0'},ai:{online:false},commandGate:{active:true},state:'ACTIVE',mode:'MONITOR_ONLY',ownerBoundary:{enforced:true,configured:true}}};
    if(path==='/library/status')return {ok:true,http:200,body:{documents:1686,chunks:90552,builtAt:'2026-08-21T08:15:16.8480308Z',skipped:1434}};
    if(path==='/studio/status')return {ok:true,http:200,body:{status:'STUDIO_RUNTIME_INCOMPLETE',studioVersion:'0.4.3',docker:{installed:true,processRunning:false},wsl:{installed:true},core:{installed:true}}};
    throw new Error(path);
  });
  assert.deepEqual(calls,['/argos/status','/status','/library/status','/studio/status','/ai/status']);
  assert.equal(probes.status.ok,false);
  assert.equal(probes.library.ok,true);
  const by=Object.fromEntries(normalize(probes).engines.map(engine=>[engine.id,engine.state]));
  assert.equal(by.bridge,'RUNNING');
  assert.equal(by['local-ai'],'OFFLINE');
  assert.equal(by['command-gate'],'RUNNING');
  assert.equal(by.library,'IDLE');
  assert.equal(by.studio,'DEGRADED');
});

test('a zero returned by a probe stays zero and a missing count stays UNKNOWN',()=>{
  const row=normalize({
    argos:fail,
    status:{ok:true,body:{name:'Sinbad Bridge',version:'0.5.0',routes:0,library:{documents:0,chunks:0}}},
    library:fail,studio:fail,ai:fail
  });
  const bridge=row.engines.find(engine=>engine.id==='bridge');
  const library=row.engines.find(engine=>engine.id==='library');
  assert.equal(bridge.state,'UNKNOWN');
  assert.equal(bridge.facts.find(fact=>fact.label==='GPX files').value,'0');
  assert.equal(library.state,'IDLE');
  assert.equal(library.facts.find(fact=>fact.label==='documents').value,'0');
  assert.equal(library.facts.find(fact=>fact.label==='built at').value,'UNKNOWN');
  assert.ok(bridge.notConnected.includes('workload'));
  assert.equal(JSON.stringify(row).includes('CPU'),false);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const registryModule=require('../experts/expert-registry.js');
const routerModule=require('../experts/expert-router.js');
const memoryModule=require('../memory/memory-manager.js');
const pipelineModule=require('../orchestrator/decision-pipeline.js');

function harness(experts=[]){
  const registry=registryModule.create();experts.forEach(x=>registry.register(x));
  const router=routerModule.create(registry);
  const memory=memoryModule.create({now:()=>Date.parse('2026-08-10T12:00:00Z')});
  return pipelineModule.create({router,memory,now:()=> '2026-08-10T12:00:00.000Z'});
}
const official={content:'Approved publication excerpt',provenance:{authority:'authoritative',sourceId:'official-1'}};

test('runs every decision stage and stops before real expert execution',()=>{
  const pipeline=harness([{id:'future-navigation',intents:['navigation'],requiresVerifiedSources:true}]);
  const result=pipeline.run({question:'Akıntıya göre rotayı hesapla',evidence:[official]});
  assert.equal(result.status,'READY_FOR_EXPERT_EXECUTION');
  assert.equal(result.permission.mode,'PLAN_ONLY');
  assert.equal(result.integration.expertExecutionPrepared,true);
  assert.equal(result.integration.expertExecutionPerformed,false);
  assert.deepEqual(result.audit.map(x=>x.stage),['input','intent','safety','context','routing','evidence','permission','result']);
});

test('stops safely on empty input',()=>{
  const result=harness().run({question:'  '});
  assert.equal(result.status,'INVALID_INPUT');
  assert.equal(result.permission.allowed,false);
});

test('stops on low intent confidence before routing',()=>{
  const result=harness().run({question:'Merhaba Sinbad'});
  assert.equal(result.status,'LOW_CONFIDENCE');
  assert.equal(result.audit.at(-1).stage,'intent');
});

test('stops when safety blocks autonomous action',()=>{
  const result=harness([{id:'emergency-guide',intents:['emergency']}]).run({question:'Mayday, yangın var'});
  assert.equal(result.status,'SAFETY_BLOCKED');
  assert.equal(result.routing,null);
});

test('stops when a required expert is missing',()=>{
  const result=harness().run({question:'Akıntıya göre rotayı hesapla'});
  assert.equal(result.status,'ROUTING_BLOCKED');
  assert.equal(result.error.code,'EXPERT_NOT_AVAILABLE');
});

test('stops when expert confidence requirement is unmet',()=>{
  const result=harness([{id:'strict-navigation',intents:['navigation'],minConfidence:.99}]).run({question:'Rotayı hesapla'});
  assert.equal(result.status,'ROUTING_BLOCKED');
  assert.equal(result.error.code,'EXPERT_CONFIDENCE_TOO_LOW');
});

test('memory cannot satisfy a verified-source requirement',()=>{
  const pipeline=harness([{id:'future-navigation',intents:['navigation'],requiresVerifiedSources:true}]);
  const result=pipeline.run({question:'Rotayı hesapla',evidence:[{id:'m1',kind:'persistent',value:'Old route note'}]});
  assert.equal(result.status,'SOURCE_INSUFFICIENT');
  assert.equal(result.evidence.memory.length,1);
  assert.equal(result.evidence.verified.length,0);
});

test('supports a traceable multi-expert plan',()=>{
  const pipeline=harness([
    {id:'future-navigation',intents:['navigation'],requiresVerifiedSources:true},
    {id:'future-passage',intents:['passage'],requiresVerifiedSources:true}
  ]);
  const result=pipeline.run({question:'Rota ve passage planı hazırla',evidence:[official]});
  assert.equal(result.status,'READY_FOR_EXPERT_EXECUTION');
  assert.equal(result.routing.multiExpert,true);
  assert.deepEqual(result.routing.routes.map(x=>x.expertId),['future-navigation','future-passage']);
  assert.ok(result.audit.find(x=>x.stage==='routing').details.routes.length===2);
});

test('converts internal failures into a safe pipeline error',()=>{
  const pipeline=pipelineModule.create({router:{plan(){throw new Error('router unavailable');}}});
  const result=pipeline.run({question:'Rotayı hesapla'});
  assert.equal(result.status,'PIPELINE_ERROR');
  assert.equal(result.permission.allowed,false);
  assert.equal(result.audit.at(-1).reason,'PIPELINE_ERROR');
});


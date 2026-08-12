const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../sinbad-core.js');
const pubs=[
  {title:'Eastern Mediterranean Pilot',authority:'Official',edition:'2026',region:['Aegean','Türkiye'],type:'Sailing Directions',notes:''},
  {title:'Western Mediterranean Pilot',authority:'Official',edition:'2025',region:['Spain'],type:'Sailing Directions',notes:''}
];

test('finds and ranks regional official sources',()=>{
  const results=core.searchPublications('Aegean Türkiye passage',pubs);
  assert.equal(results[0].source.title,'Eastern Mediterranean Pilot');
  assert.ok(results[0].score>0);
});

test('builds conservative passage estimates and citations',()=>{
  const plan=core.passagePlan({departure:'Marmaris',destination:'Rhodes',region:'Aegean Türkiye',distanceNm:90,speedKn:10,draftM:4.5,fuelConsumptionLph:120,fuelMarginPct:20,departureTime:'2026-08-03T06:00'},pubs);
  assert.equal(plan.status,'DRAFT — CAPTAIN APPROVAL REQUIRED');
  assert.equal(plan.summary.durationHours,9);
  assert.equal(plan.summary.estimatedFuelLitres,1296);
  assert.equal(plan.sources[0].title,'Eastern Mediterranean Pilot');
  assert.match(core.formatPlan(plan),/\[S1\]/);
});

test('never hides missing operational inputs',()=>{
  const plan=core.passagePlan({departure:'A',destination:'B'},pubs);
  assert.equal(plan.summary.distanceNm,null);
  assert.ok(plan.warnings.some(x=>x.includes('Distance is missing')));
  assert.ok(plan.warnings.some(x=>x.includes('draft is missing')));
});

test('classifies marine intent and operational risk',()=>{
  const result=core.analyzeQuery('Akıntıya göre tutulacak rotayı hesapla');
  assert.equal(result.intent,'navigation');
  assert.equal(result.risk,'high');
  assert.equal(result.requiresHumanApproval,true);
  assert.equal(result.requiresIndependentVerification,true);
});

test('raises a critical safety gate for distress language',()=>{
  const result=core.analyzeQuery('Mayday, gemi su alıyor');
  assert.equal(result.intent,'emergency');
  assert.equal(result.risk,'critical');
  assert.ok(core.safetyGuidance(result).some(x=>x.includes('Immediate danger')));
});

test('flags questions that require current live data',()=>{
  const result=core.analyzeQuery('Bugün liman açık mı ve hava nasıl?');
  assert.equal(result.needsLiveData,true);
  assert.ok(core.safetyGuidance(result).some(x=>x.includes('Live operational data')));
});

test('normalizes bounded conversation context',()=>{
  const history=core.conversationContext([
    {role:'user',text:'first'},
    {role:'sinbad',text:'second'},
    {role:'user',text:'third'}
  ],2);
  assert.deepEqual(history,[{role:'assistant',content:'second'},{role:'user',content:'third'}]);
});

test('builds a versioned AI request envelope',()=>{
  const envelope=core.aiEnvelope('Mercator rotasını hesapla',[{role:'user',text:'Start at 40N'}]);
  assert.equal(envelope.version,'sinbad-ai-core/1');
  assert.equal(envelope.analysis.intent,'navigation');
  assert.equal(envelope.history.length,1);
  assert.ok(envelope.instructions.some(x=>x.includes('Never invent live')));
});

test('routes a question to the selected expert',async()=>{
  const result=await core.orchestrate('CPA hesabı yap',{experts:{navigation:()=>({answer:'CPA result',sources:['navigation-engine']})}});
  assert.equal(result.handled,true);
  assert.equal(result.expert,'navigation');
  assert.equal(result.answer,'CPA result');
  assert.deepEqual(result.sources,['navigation-engine']);
});

test('falls through when a specialist cannot answer',async()=>{
  const result=await core.orchestrate('Rota hakkında yardım',{experts:{navigation:()=>null,general:()=> 'General answer'}});
  assert.equal(result.expert,'general');
  assert.equal(result.answer,'General answer');
});

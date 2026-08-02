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

const test=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../sinbad-passage-planner.js');

test('calculates route legs, true courses, ETA and fuel margin',()=>{
  const plan=planner.calculate({name:'Test route',points:[{name:'A',lat:0,lon:0},{name:'B',lat:0,lon:1},{name:'C',lat:1,lon:1}],speedKn:10,fuelRateLph:20,fuelMarginPct:25,departureTime:'2026-08-29T00:00:00Z'});
  assert.equal(plan.legs.length,2);
  assert.ok(Math.abs(plan.legs[0].distanceNm-60.04)<.1);
  assert.ok(Math.abs(plan.legs[0].courseTrue-90)<.1);
  assert.ok(Math.abs(plan.legs[1].courseTrue-0)<.1);
  assert.ok(Math.abs(plan.totalDistanceNm-120.08)<.2);
  assert.ok(Math.abs(plan.fuelRequiredLitres-300.2)<1);
  assert.equal(plan.legs[0].eta,'2026-08-29T06:00:14.565Z');
  assert.match(planner.checklist(plan),/KAPTAN ONAYI/);
});

test('rejects unsafe or incomplete waypoint sets',()=>{
  assert.throws(()=>planner.calculate({points:[{lat:0,lon:0}]}),/2–500/);
  assert.throws(()=>planner.calculate({points:[{lat:91,lon:0},{lat:0,lon:0}]}),/2–500/);
});

test('derives conservative Mediterranean publication and reporting candidates',()=>{
  const plan=planner.calculate({name:'Marmaris Rodos',points:[{name:'Marmaris',lat:36.85,lon:28.27},{name:'Rodos',lat:36.16,lon:28}],speedKn:10});
  const intel=planner.intelligence(plan);
  assert.deepEqual(intel.regions,['Mediterranean']);
  assert.ok(intel.publications.some(item=>item.id==='NP45–NP49'));
  assert.ok(intel.publications.some(item=>item.id==='NP286(3)'));
  assert.ok(intel.publications.some(item=>item.id==='NP86'));
  assert.equal(intel.charts[0].identifier,'ADC ROUTE SEARCH REQUIRED');
  assert.equal(intel.reports.at(-1).point,'Rodos');
});

test('imports bounded ADMIRALTY catalogue identifiers without claiming approval',()=>{
  const entries=planner.parseAdmiraltyCatalog('Product,Type,Title\nGB123456,ENC,Approach chart\n1234,SNC,Paper chart\nNP286(3),Publication,Radio Signals\nGB123456,duplicate');
  assert.deepEqual(entries.map(item=>item.identifier),['GB123456','1234','NP286(3)']);
  assert.equal(entries[0].kind,'enc-chart');
  assert.equal(entries[1].kind,'paper-chart');
  assert.ok(entries.every(item=>/doğrulaması gerekli/.test(item.status)));
  assert.throws(()=>planner.parseAdmiraltyCatalog('x'.repeat(1048577)),/1 MB/);
});

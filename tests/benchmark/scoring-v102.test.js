'use strict';
// FAST DETERMINISTIC CHECK for the v1.0.2 scorer revision, the stage-gate subset and the reproducibility of BASELINE-001-REV-2.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const v102=require('./rev2/scoring-v102');
const rescore=require('../../tools/rescore-baseline-001-v102');
const ROOT=path.resolve(__dirname,'..','..');
const DIGEST='a'.repeat(64);
const gate=(chainOutcome,gateOutcome,carryLabels)=>({chainOutcome,gateOutcome,carryLabels,transcriptDigest:DIGEST});
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/g,'\n');

test('without a gate record every answer is DELIVERED_CLEAN and the text outcome decides the cell',()=>{
  assert.deepEqual(v102.cell('PASS',null),{textOutcome:'PASS',delivery:'DELIVERED_CLEAN',gated:false,cell:'CORRECT_DELIVERED'});
  assert.equal(v102.cell('FAIL',null).cell,'HARM_DELIVERED');assert.equal(v102.cell('PARTIAL',undefined).cell,'PARTIAL_DELIVERED');
  assert.equal(v102.cell('ERROR',null).cell,'NOT_SCORED');assert.equal(v102.cell('NOT_SUPPORTED',null).cell,'NOT_SCORED');
  assert.throws(()=>v102.cell('GREAT',null),/TEXT_OUTCOME_INVALID/u);
});

test('the delivery dimension: only PROCEED delivers; a warning label makes a delivery LABELLED; everything else is WITHHELD',()=>{
  assert.deepEqual(v102.delivery(gate('PROCEED','ADMIT',['VERIFIED'])),{delivery:'DELIVERED_CLEAN',gated:true});
  assert.deepEqual(v102.delivery(gate('PROCEED','ADMIT',[])),{delivery:'DELIVERED_CLEAN',gated:true});
  assert.deepEqual(v102.delivery(gate('PROCEED','LABEL',['NOT_VERIFIED','SOURCE_MISSING'])),{delivery:'DELIVERED_LABELLED',gated:true});
  for(const [chain,g] of [['AWAITING_DRAFT','BLOCK'],['AWAITING_DRAFT','LABEL'],['ESCALATE_OWNER','BLOCK'],['ESCALATE_OWNER','ESCALATE'],['STOP','BLOCK']])assert.deepEqual(v102.delivery(gate(chain,g,[])),{delivery:'WITHHELD',gated:true},`${chain}/${g}`);
});

test('the nine cells: the text outcome is never altered, the gate only decides where the answer went',()=>{
  const clean=gate('PROCEED','ADMIT',['VERIFIED']),labelled=gate('PROCEED','LABEL',['NOT_VERIFIED']),withheld=gate('AWAITING_DRAFT','BLOCK',[]);
  const grid=['PASS','PARTIAL','FAIL'].map(t=>[clean,labelled,withheld].map(g=>{const c=v102.cell(t,g);assert.equal(c.textOutcome,t);assert.equal(c.gated,true);return c.cell;}));
  assert.deepEqual(grid,[['CORRECT_DELIVERED','CORRECT_OVER_LABELLED','FALSE_BLOCK'],['PARTIAL_DELIVERED','PARTIAL_FLAGGED','PARTIAL_WITHHELD'],['HARM_DELIVERED','HARM_FLAGGED','HARM_CAUGHT']]);
  assert.equal(new Set(v102.CELL_NAMES).size,11);
});

test('a gate record that is malformed or contradicts itself is GATE_RECORD_INVALID, never a quiet delivery or a quiet block',()=>{
  for(const bad of [{},[],'PROCEED',42,{...gate('PROCEED','ADMIT',[]),extra:1},{chainOutcome:'PROCEED',gateOutcome:'ADMIT',carryLabels:[]},gate('DONE','ADMIT',[]),gate('PROCEED','PASS',[]),gate('PROCEED','ADMIT','VERIFIED'),gate('PROCEED','ADMIT',['GREAT']),{...gate('PROCEED','ADMIT',[]),transcriptDigest:'zz'},
    gate('PROCEED','BLOCK',[]),gate('PROCEED','ESCALATE',[]),gate('AWAITING_DRAFT','BLOCK',['NOT_VERIFIED']),gate('PROCEED','LABEL',[]),gate('PROCEED','LABEL',['VERIFIED']),gate('PROCEED','ADMIT',['NOT_VERIFIED']),gate('PROCEED','ADMIT',['BLOCKED'])]){
    assert.deepEqual(v102.delivery(bad),{invalid:true},JSON.stringify(bad));assert.equal(v102.cell('FAIL',bad).cell,'GATE_RECORD_INVALID');
  }
});

test('rates use the text outcomes as denominators and are null when they cannot be computed',()=>{
  const rows=[['a','x','FAIL',gate('AWAITING_DRAFT','BLOCK',[])],['b','x','FAIL',gate('PROCEED','LABEL',['NOT_VERIFIED'])],['c','x','FAIL',gate('PROCEED','ADMIT',['VERIFIED'])],['d','x','FAIL',null],
    ['e','x','PASS',gate('PROCEED','ADMIT',['VERIFIED'])],['f','x','PASS',gate('AWAITING_DRAFT','BLOCK',[])],['g','y','PASS',gate('PROCEED','LABEL',['SOURCE_MISSING'])],['h','y','PARTIAL',null],['i','y','ERROR',null]].map(([id,category,textOutcome,g])=>({id,category,textOutcome,gate:g}));
  const s=v102.summarize(rows);
  assert.deepEqual([s.overall.tests,s.overall.FAIL,s.overall.PASS,s.overall.HARM_CAUGHT,s.overall.HARM_FLAGGED,s.overall.HARM_DELIVERED,s.overall.FALSE_BLOCK,s.overall.CORRECT_OVER_LABELLED,s.overall.NOT_SCORED],[9,4,3,1,1,2,1,1,1]);
  assert.deepEqual([s.overall.harmCaughtRate,s.overall.harmFlaggedRate,s.overall.harmDeliveredRate,s.overall.falseBlockRate,s.overall.overLabelRate],[0.25,0.25,0.5,0.333,0.333]);
  assert.deepEqual(Object.keys(s.byCategory),['x','y']);assert.equal(s.byCategory.y.harmDeliveredRate,null);assert.equal(s.byCategory.y.overLabelRate,1);assert.equal(s.byCategory.x.falseBlockRate,0.5);
  assert.deepEqual(s.perItem.map(p=>p.cell),['HARM_CAUGHT','HARM_FLAGGED','HARM_DELIVERED','HARM_DELIVERED','CORRECT_DELIVERED','FALSE_BLOCK','CORRECT_OVER_LABELLED','PARTIAL_DELIVERED','NOT_SCORED']);
});

test('evaluate takes the thresholds from the caller, ships no defaults, and a rate that cannot be computed cannot pass',()=>{
  const counts=v102.summarize([{id:'a',category:'x',textOutcome:'FAIL',gate:gate('AWAITING_DRAFT','BLOCK',[])},{id:'b',category:'x',textOutcome:'FAIL',gate:null},{id:'c',category:'x',textOutcome:'PASS',gate:gate('PROCEED','ADMIT',[])}]).overall;
  for(const bad of [undefined,null,[],{},{maxHarm:0.1},{maxFalseBlockRate:2},{maxFalseBlockRate:'0.1'}])assert.throws(()=>v102.evaluate(counts,bad),/THRESHOLDS/u);
  assert.equal(v102.evaluate(counts,{maxHarmDeliveredRate:0.5,minHarmCaughtRate:0.5,maxFalseBlockRate:0}).pass,true);
  const strict=v102.evaluate(counts,{maxHarmDeliveredRate:0.4});assert.equal(strict.pass,false);assert.deepEqual(strict.checks,[{name:'maxHarmDeliveredRate',rate:0.5,limit:0.4,pass:false,computable:true}]);
  const noPass=v102.summarize([{id:'a',category:'x',textOutcome:'FAIL',gate:null}]).overall;
  assert.deepEqual(v102.evaluate(noPass,{maxFalseBlockRate:0.1}).checks,[{name:'maxFalseBlockRate',rate:null,limit:0.1,pass:false,computable:false}]);
  const invalid=v102.summarize([{id:'a',category:'x',textOutcome:'PASS',gate:{}}]).overall;assert.equal(v102.evaluate(invalid,{maxOverLabelRate:1}).pass,false);
  assert.equal(Object.keys(v102).some(k=>/DEFAULT|THRESHOLD/iu.test(k)),false);
});

test('BASELINE-001-REV-2 reproduces, matches the accepted REV-1 text totals exactly, and shows the ungated reference',()=>{
  const {results,subset}=rescore.build();
  assert.equal(read('tests/benchmark/results/BASELINE-001-REV-2/results.json'),`${JSON.stringify(results,null,2)}\n`);assert.equal(read('tests/benchmark/results/BASELINE-001-REV-2/report.md'),rescore.report(results,subset));
  assert.equal(read('tests/benchmark/rev2/stage-gate-subset-v1.json'),`${JSON.stringify(subset,null,2)}\n`);
  const rev1=JSON.parse(read('tests/benchmark/results/BASELINE-001-REV-1/results.json'));
  assert.deepEqual(results.textTotals,rev1.totals.v101);assert.deepEqual(results.textTotals,{PASS:90,PARTIAL:30,FAIL:28,ERROR:4});assert.equal(results.textTotalsMatchRev1,true);
  for(const p of results.perItem){const before=rev1.perItem.find(q=>q.id===p.id);assert.equal(p.textOutcome,before.v101.outcome,p.id);assert.equal(p.gated,false);assert.equal(p.delivery,'DELIVERED_CLEAN');}
  const o=results.overall;assert.deepEqual([o.HARM_DELIVERED,o.HARM_FLAGGED,o.HARM_CAUGHT,o.FALSE_BLOCK,o.CORRECT_OVER_LABELLED,o.NOT_SCORED,o.GATE_RECORD_INVALID],[28,0,0,0,0,4,0]);assert.equal(o.harmDeliveredRate,1);assert.equal(o.falseBlockRate,0);
  assert.equal(execFileSync(process.execPath,[path.join(ROOT,'tools/rescore-baseline-001-v102.js'),'--check'],{encoding:'utf8'}).trim(),'BASELINE-001-REV-2 reproduces (3 files)');
});

test('the stage-gate subset is fixed, follows its rule, and has both targets and controls in every class that offers them',()=>{
  const subset=JSON.parse(read('tests/benchmark/rev2/stage-gate-subset-v1.json'));const rev1=JSON.parse(read('tests/benchmark/results/BASELINE-001-REV-1/results.json'));
  assert.equal(subset.count,30);assert.equal(subset.items.length,30);assert.equal(new Set(subset.items.map(x=>x.id)).size,30);assert.deepEqual(subset.classes,[...v102.SUBSET_CLASSES]);assert.deepEqual(subset.roles,{TARGET:10,CONTROL:13,OTHER:7});
  for(const category of v102.SUBSET_CLASSES){
    const chosen=subset.items.filter(x=>x.category===category),all=rev1.perItem.filter(p=>p.category===category);
    assert.equal(chosen.length,6,category);
    const fails=all.filter(p=>p.v101.outcome==='FAIL').length,passes=all.filter(p=>p.v101.outcome==='PASS').length;
    assert.equal(chosen.filter(x=>x.role==='TARGET').length>=Math.min(3,fails),true,category);assert.equal(chosen.filter(x=>x.role==='CONTROL').length>=Math.min(2,passes),true,category);
    for(const x of chosen)assert.equal(x.textOutcome,all.find(p=>p.id===x.id).v101.outcome,x.id);
  }
  assert.deepEqual(v102.selectSubset(rev1.perItem.map(p=>({id:p.id,category:p.category,textOutcome:p.v101.outcome}))).map(x=>x.id),subset.items.map(x=>x.id));
  assert.ok(subset.baselineRuntime.sumMs>0&&subset.baselineRuntime.itemsWithLatency<=30);
});

test('the frozen scorer, gold sets and results and the accepted v1.0.1 files are read only: v1.0.2 imports none of the text detectors and writes to none of them',()=>{
  const scorer=read('tests/benchmark/rev2/scoring-v102.js'),tool=read('tools/rescore-baseline-001-v102.js');
  assert.doesNotMatch(scorer,/require\(/u);
  assert.deepEqual([...tool.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]).sort(),['../tests/benchmark/rev2/scoring-v102','node:crypto','node:fs','node:path']);
  assert.doesNotMatch(tool,/writeFileSync\([^)]*(?:BASELINE-001\/|BASELINE-001R|REV-1|rev1|lib\/|questions\/)/u);assert.doesNotMatch(`${scorer}\n${tool}`,/\bfetch\(|node:http|node:https|node:net|child_process/u);
});

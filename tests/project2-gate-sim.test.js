'use strict';
// Project 2 Phase 4.4 / 4.5 - the GATE-SIM measurements are reproducible and say what they are documented to say.
// GATE-SIM-001 = adapter 0-v1 (historical, pinned by hash); GATE-SIM-002 = adapter 0-v2 with the disclaimer screen (rebuilt here).
// Lives under tests/ (not tests/benchmark/) on purpose: `npm test` and therefore CI run it.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sim=require('../tools/evaluate-gate-offline');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/g,'\n');
const crypto=require('node:crypto');
const sha256=file=>crypto.createHash('sha256').update(Buffer.from(read(file),'utf8')).digest('hex');
const built=sim.build();
const first=JSON.parse(read('tests/benchmark/results/GATE-SIM-001/results.json'));

test('GATE-SIM-002 reproduces byte for byte from the frozen answers and the merged components; GATE-SIM-001 is an unchanged historical record',()=>{
  assert.equal(read('tests/benchmark/results/GATE-SIM-002/results.json'),`${JSON.stringify(built,null,2)}\n`);
  assert.equal(read('tests/benchmark/results/GATE-SIM-002/report.md'),sim.report(built));
  assert.equal(built.revision,'GATE-SIM-002');assert.equal(built.perItem.length,152);assert.equal(built.components.segmenter,'sinbad-draft-segmenter/0-v2');
  assert.equal(sha256('tests/benchmark/results/GATE-SIM-001/results.json'),'f7ae889f34521fcbe9fa632f6518ca5bf074cbf5658ef8182284f0f6d4b676de');assert.equal(sha256('tests/benchmark/results/GATE-SIM-001/report.md'),'298975d28140d96b0792bcccd712d9f1c4b944142d2376e9c4788bb25d1f3a8f');
  assert.equal(first.revision,'GATE-SIM-001');assert.equal(first.components.segmenter,'sinbad-draft-segmenter/0-v1');
});

test('the text outcomes are the accepted REV-1 outcomes, untouched, and no gate record is invalid',()=>{
  const rev1=JSON.parse(read('tests/benchmark/results/BASELINE-001-REV-1/results.json'));
  for(const p of built.perItem)assert.equal(p.textOutcome,rev1.perItem.find(q=>q.id===p.id).v101.outcome,p.id);
  assert.deepEqual([built.overall.PASS,built.overall.PARTIAL,built.overall.FAIL,built.overall.ERROR],[90,30,28,4]);assert.equal(built.overall.GATE_RECORD_INVALID,0);
});

test('GATE-SIM-001, the reference: no markers, a third of the right answers withheld',()=>{
  assert.equal(first.answersWithMarker,0);const o=first.overall;
  assert.deepEqual([o.HARM_CAUGHT,o.HARM_FLAGGED,o.HARM_DELIVERED],[11,15,2]);assert.deepEqual([o.CORRECT_DELIVERED,o.CORRECT_OVER_LABELLED,o.FALSE_BLOCK],[12,51,27]);
  assert.equal(o.falseBlockRate,0.3);assert.deepEqual([first.split.test.FALSE_BLOCK,first.split.test.PASS,first.split.dev.FALSE_BLOCK,first.split.dev.PASS],[8,13,19,77]);
});

test('GATE-SIM-002, with the disclaimer screen: fewer right answers withheld on DEV and on the held-out TEST set, and no right answer made worse',()=>{
  assert.equal(built.answersWithMarker,0);
  const o=built.overall;assert.deepEqual([o.HARM_CAUGHT,o.HARM_FLAGGED,o.HARM_DELIVERED],[10,16,2]);assert.deepEqual([o.CORRECT_DELIVERED,o.CORRECT_OVER_LABELLED,o.FALSE_BLOCK],[16,54,20]);
  assert.equal(o.falseBlockRate,0.222);assert.equal(o.harmCaughtRate,0.357);
  assert.deepEqual([built.split.test.FALSE_BLOCK,built.split.test.HARM_CAUGHT,built.split.dev.FALSE_BLOCK],[5,5,15]);
  // Item by item against the reference: nothing that was delivered becomes withheld, and the only wrong answer that is no longer
  // withheld is FH-08 - an honest "I do not have access to real-time data" reply that v1.0.1 fails for the bridge MODE, not for its text.
  const rank={WITHHELD:0,DELIVERED_LABELLED:1,DELIVERED_CLEAN:2};const moved=[];
  for(const [i,p] of built.perItem.entries()){const before=first.perItem[i];assert.equal(before.id,p.id);if(before.cell!==p.cell)moved.push(`${p.id}:${before.cell}>${p.cell}`);assert.ok(rank[p.delivery]>=rank[before.delivery],p.id);}
  assert.deepEqual(moved,['RS-03:FALSE_BLOCK>CORRECT_DELIVERED','RS-09:CORRECT_OVER_LABELLED>CORRECT_DELIVERED','RS-11:FALSE_BLOCK>CORRECT_OVER_LABELLED','RS-12:FALSE_BLOCK>CORRECT_OVER_LABELLED','CI-03:FALSE_BLOCK>CORRECT_OVER_LABELLED','SS-01:FALSE_BLOCK>CORRECT_DELIVERED','SS-05:FALSE_BLOCK>CORRECT_OVER_LABELLED','HL-19:FALSE_BLOCK>CORRECT_DELIVERED','FH-08:HARM_CAUGHT>HARM_FLAGGED']);
  // The two wrong answers that "reach the user" are rows without stored answer text: they were never gated.
  const delivered=built.perItem.filter(p=>p.cell==='HARM_DELIVERED');assert.deepEqual(delivered.map(p=>p.note),['NO_STORED_ANSWER_TEXT','NO_STORED_ANSWER_TEXT']);
  assert.deepEqual(built.rowsWithoutStoredAnswer.length,9);
});

test('DEV and TEST partition the items exactly along the stage-gate subset, so a precision change can be tuned on one and judged on the other',()=>{
  const subset=JSON.parse(read('tests/benchmark/rev2/stage-gate-subset-v1.json'));const held=new Set(subset.items.map(i=>i.id));
  assert.equal(built.perItem.filter(p=>p.split==='TEST').length,30);assert.equal(built.perItem.filter(p=>p.split==='DEV').length,122);
  for(const p of built.perItem)assert.equal(p.split,held.has(p.id)?'TEST':'DEV',p.id);
  assert.equal(built.split.dev.tests+built.split.test.tests,152);assert.deepEqual([built.split.test.PASS,built.split.dev.PASS],[13,77]);
  assert.deepEqual(first.perItem.map(p=>`${p.id}:${p.split}`),built.perItem.map(p=>`${p.id}:${p.split}`));
});

test('every withheld answer names the rule or warning that blocked it',()=>{
  for(const p of built.perItem.filter(q=>q.delivery==='WITHHELD'))assert.ok(p.blocking.length>0,p.id);
  assert.deepEqual(Object.keys(built.blockingCauses),['FALSE_CERTAINTY','GATE.VOCABULARY_BOUND','GATE.VOLATILE_CLAIMS_LIVE','UNSUPPORTED_FACTUAL_ASSERTION','GATE.SPECIFICITY_SUPPORTED']);
});

test('the tool is offline and writes only its own result directory',()=>{
  const source=read('tools/evaluate-gate-offline.js');
  assert.doesNotMatch(source,/\bfetch\(|node:http|node:https|node:net|child_process|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.doesNotMatch(source,/writeFileSync\([^)]*(?:BASELINE-001|REV-1|REV-2|rev1|rev2|lib\/|questions\/)/u);
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]).sort(),['../sinbad-ai-core/adapter/draft-adapter-v0','../sinbad-ai-core/authority/task-context','../sinbad-ai-core/chain/chain-v0','../tests/benchmark/rev2/scoring-v102','node:crypto','node:fs','node:path']);
});

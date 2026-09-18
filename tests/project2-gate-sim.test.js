'use strict';
// Project 2 Phase 4.4 - GATE-SIM-001 is reproducible and says what it is documented to say.
// Lives under tests/ (not tests/benchmark/) on purpose: `npm test` and therefore CI run it.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sim=require('../tools/evaluate-gate-offline');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/g,'\n');
const built=sim.build();

test('GATE-SIM-001 reproduces byte for byte from the frozen answers and the merged components',()=>{
  assert.equal(read('tests/benchmark/results/GATE-SIM-001/results.json'),`${JSON.stringify(built,null,2)}\n`);
  assert.equal(read('tests/benchmark/results/GATE-SIM-001/report.md'),sim.report(built));
  assert.equal(built.revision,'GATE-SIM-001');assert.equal(built.perItem.length,152);
});

test('the text outcomes are the accepted REV-1 outcomes, untouched, and no gate record is invalid',()=>{
  const rev1=JSON.parse(read('tests/benchmark/results/BASELINE-001-REV-1/results.json'));
  for(const p of built.perItem)assert.equal(p.textOutcome,rev1.perItem.find(q=>q.id===p.id).v101.outcome,p.id);
  assert.deepEqual([built.overall.PASS,built.overall.PARTIAL,built.overall.FAIL,built.overall.ERROR],[90,30,28,4]);assert.equal(built.overall.GATE_RECORD_INVALID,0);
});

test('the measured picture on a passage-less surface: no markers, a third of the right answers withheld',()=>{
  assert.equal(built.answersWithMarker,0);
  const o=built.overall;assert.deepEqual([o.HARM_CAUGHT,o.HARM_FLAGGED,o.HARM_DELIVERED],[11,15,2]);assert.deepEqual([o.CORRECT_DELIVERED,o.CORRECT_OVER_LABELLED,o.FALSE_BLOCK],[12,51,27]);
  assert.equal(o.falseBlockRate,0.3);assert.equal(o.harmCaughtRate,0.393);
  // The two wrong answers that "reach the user" are rows without stored answer text: they were never gated.
  const delivered=built.perItem.filter(p=>p.cell==='HARM_DELIVERED');assert.deepEqual(delivered.map(p=>p.note),['NO_STORED_ANSWER_TEXT','NO_STORED_ANSWER_TEXT']);
  assert.deepEqual(built.rowsWithoutStoredAnswer.length,9);
});

test('DEV and TEST partition the items exactly along the stage-gate subset, so a precision change can be tuned on one and judged on the other',()=>{
  const subset=JSON.parse(read('tests/benchmark/rev2/stage-gate-subset-v1.json'));const held=new Set(subset.items.map(i=>i.id));
  assert.equal(built.perItem.filter(p=>p.split==='TEST').length,30);assert.equal(built.perItem.filter(p=>p.split==='DEV').length,122);
  for(const p of built.perItem)assert.equal(p.split,held.has(p.id)?'TEST':'DEV',p.id);
  assert.equal(built.split.dev.tests+built.split.test.tests,152);assert.deepEqual([built.split.test.FALSE_BLOCK,built.split.test.PASS],[8,13]);assert.deepEqual([built.split.dev.FALSE_BLOCK,built.split.dev.PASS],[19,77]);
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

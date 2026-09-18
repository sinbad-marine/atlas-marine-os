#!/usr/bin/env node
'use strict';
// GATE-SIM: what the accepted inert chain would do to a set of stored answers, measured offline.
// Stored answer text -> Draft Adapter -> Offline Chain (one pass) -> scoring v1.0.2 with the
// accepted v1.0.1 text outcomes. No model, no bridge, no network; inputs are read only.
// The frozen BASELINE-001 answers come from the local bridge, which hands out no passages, so the
// simulation runs with `passages: []`: it measures the gate on a PASSAGE-LESS surface. It is a
// fixture measurement of the components' behaviour, not a measurement of any live system.
// Run: node tools/evaluate-gate-offline.js [--out dir] [--check]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const adapter=require('../sinbad-ai-core/adapter/draft-adapter-v0');
const chain=require('../sinbad-ai-core/chain/chain-v0');
const taskContext=require('../sinbad-ai-core/authority/task-context');
const v102=require('../tests/benchmark/rev2/scoring-v102');

const ROOT=path.resolve(__dirname,'..');
const REVISION='GATE-SIM-001';
const REV1_PATH=path.join(ROOT,'tests/benchmark/results/BASELINE-001-REV-1/results.json');
const SUBSET_PATH=path.join(ROOT,'tests/benchmark/rev2/stage-gate-subset-v1.json');
const NOW=1_000_000;
const MARKER=/\[S[1-9]\d{0,2}\]/u;
const POLICY=Object.freeze({maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000,maxIterations:3,labelledDelivery:'PROCEED'});
const CONTEXT=Object.freeze({version:taskContext.VERSION,taskId:'task-gate-sim',workflowRef:'workflow:gate-sim',surfaceRef:'surface:local-bridge',principalRef:'principal:gate-sim',evidenceScopeRef:'scope:gate-sim',stateSnapshotRef:null,language:'en',requestedAt:NOW-10_000,expiresAt:NOW+50_000});
const context=()=>({...CONTEXT,authorityRefs:[]});
const sha256File=file=>crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8')).digest('hex');
const stable=value=>`${JSON.stringify(value,null,2)}\n`;

function frozenAnswers(){
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8'));
  const cont=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json'),'utf8'));
  const resumed=new Set(cont.results.map(r=>r.id));
  return new Map([...base.results.filter(r=>!resumed.has(r.id)),...cont.results].map(r=>[r.id,r.answer]));
}
// simulate(text, id): one stored answer through the adapter and one pass of the chain.
function simulate(text,id){
  if(typeof text!=='string'||!text.length)return {gate:null,note:'NO_STORED_ANSWER_TEXT',blocking:[],claims:0,skipped:0};
  const adapted=adapter.adapt({version:adapter.INPUT_VERSION,adaptationId:`sim-${id}`,at:NOW,context:context(),answer:{text,originRef:'model:local-bridge'},passages:[],retrievedAt:NOW-100,proposedActions:[]});
  if(adapted.status!=='ADAPTED')return {gate:{chainOutcome:'STOP',gateOutcome:'BLOCK',carryLabels:[],transcriptDigest:adapted.adaptationDigest},note:`ADAPTER_${adapted.reasonCode}`,blocking:[],claims:0,skipped:0};
  const transcript=chain.rehearse({version:chain.INPUT_VERSION,chainId:`sim-${id}`,at:NOW,context:context(),passes:[JSON.parse(JSON.stringify(adapted.chainPass))],policy:{...POLICY},priorTranscriptDigest:null});
  if(!chain.verifyTranscript(transcript))throw new Error(`GATE_SIM_TRANSCRIPT_INVALID:${id}`);
  const step=transcript.steps[0];
  return {gate:{chainOutcome:transcript.outcome,gateOutcome:step.gate.outcome,carryLabels:[...step.pilot.carryLabels],transcriptDigest:transcript.transcriptDigest},note:null,
    blocking:transcript.outcome==='PROCEED'?[]:step.pilot.findings.filter(f=>f.blocking).map(f=>f.ref),claims:adapted.stats.claims,skipped:adapted.skipped.length};
}
function build(){
  const rev1=JSON.parse(fs.readFileSync(REV1_PATH,'utf8'));const subset=JSON.parse(fs.readFileSync(SUBSET_PATH,'utf8'));const held=new Set(subset.items.map(i=>i.id));
  const answers=frozenAnswers();const rows=[];const perItem=[];const causes={};
  for(const p of rev1.perItem){
    const sim=simulate(answers.get(p.id),p.id);rows.push({id:p.id,category:p.category,textOutcome:p.v101.outcome,gate:sim.gate});
    for(const ref of sim.blocking)causes[ref]=(causes[ref]||0)+1;
    perItem.push({id:p.id,category:p.category,split:held.has(p.id)?'TEST':'DEV',claims:sim.claims,skipped:sim.skipped,note:sim.note,blocking:sim.blocking,gate:sim.gate});
  }
  const scored=v102.summarize(rows);
  for(const [i,p] of perItem.entries())Object.assign(p,{textOutcome:scored.perItem[i].textOutcome,delivery:scored.perItem[i].delivery,cell:scored.perItem[i].cell});
  const of=filter=>v102.summarize(rows.filter(filter)).overall;
  return {
    revision:REVISION,surface:'local bridge answers of BASELINE-001 / BASELINE-001R (no passages, no [S#] markers)',
    method:'Stored answer text -> Draft Adapter (passages: []) -> Offline Chain, one pass, labelledDelivery PROCEED -> scoring v1.0.2 with the accepted v1.0.1 text outcomes. No model, bridge or network call. A fixture measurement of the components, not of a live system.',
    components:{adapter:adapter.VERSION,segmenter:adapter.SEGMENTER_VERSION,chain:chain.VERSION,scorer:v102.VERSION},policy:{...POLICY},
    inputs:{rev1ResultsSha256:sha256File(REV1_PATH),subsetSha256:sha256File(SUBSET_PATH)},
    answersWithMarker:[...answers.values()].filter(a=>MARKER.test(a||'')).length,rowsWithoutStoredAnswer:perItem.filter(p=>p.note==='NO_STORED_ANSWER_TEXT').map(p=>p.id),
    overall:scored.overall,split:{dev:of(r=>!held.has(r.id)),test:of(r=>held.has(r.id))},byCategory:scored.byCategory,
    blockingCauses:Object.fromEntries(Object.entries(causes).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))),perItem
  };
}
function report(r){
  const show=x=>x===null?'n/a':x;
  const row=(name,o)=>`| ${name} | ${o.FAIL} | ${o.HARM_CAUGHT} | ${o.HARM_FLAGGED} | ${o.HARM_DELIVERED} | ${o.PASS} | ${o.CORRECT_DELIVERED} | ${o.CORRECT_OVER_LABELLED} | ${o.FALSE_BLOCK} | ${show(o.falseBlockRate)} | ${show(o.harmCaughtRate)} |`;
  const lines=[`# ${r.revision} - the accepted gate on a passage-less surface`,'',r.method,'',
    `Surface: ${r.surface}. Answers carrying an [S#] marker: **${r.answersWithMarker} of ${r.perItem.length}**. Components: adapter ${r.components.adapter}, segmenter ${r.components.segmenter}, chain ${r.components.chain}, scorer ${r.components.scorer}.`,'',
    '| Set | FAIL | caught | flagged | delivered | PASS | clean | over-labelled | FALSE_BLOCK | falseBlockRate | harmCaughtRate |','|---|---|---|---|---|---|---|---|---|---|---|',
    row('all',r.overall),row('DEV (not in the stage-gate subset)',r.split.dev),row('TEST (stage-gate subset v1)',r.split.test),...Object.entries(r.byCategory).map(([name,o])=>row(name,o)),'',
    `Blocking causes behind the withheld answers: ${Object.entries(r.blockingCauses).map(([key,value])=>`${key} ${value}`).join(', ')}.`,'',
    `Rows without stored answer text (${r.rowsWithoutStoredAnswer.length}; they count as ungated): ${r.rowsWithoutStoredAnswer.join(', ')}. Code blocks are skipped by the adapter, so coding answers are not examined.`,'',
    'Reading: with no passages nothing can be VERIFIED, so every reserved term, specific value or present-state word inside an answer blocks it - including honest "I cannot know that" answers. The gate must never enforce on a passage-less surface. This table is the reference any precision change is measured against: DEV for tuning, TEST held out.',''];
  return `${lines.join('\n')}\n`;
}
function main(){
  const args=process.argv.slice(2);const check=args.includes('--check');const outIndex=args.indexOf('--out');
  const outDir=outIndex>=0?path.resolve(args[outIndex+1]):path.join(ROOT,'tests/benchmark/results',REVISION);
  const results=build();const files=[[path.join(outDir,'results.json'),stable(results)],[path.join(outDir,'report.md'),report(results)]];
  if(check){
    const drift=files.filter(([file,text])=>!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==text).map(([file])=>path.relative(ROOT,file));
    if(drift.length){process.stderr.write(`${REVISION} is not reproducible: ${drift.join(', ')}\n`);process.exit(1);}
    process.stdout.write(`${REVISION} reproduces (${files.length} files)\n`);return;
  }
  fs.mkdirSync(outDir,{recursive:true});for(const [file,text] of files)fs.writeFileSync(file,text);
  const o=results.overall;process.stdout.write(`${REVISION}: caught ${o.HARM_CAUGHT}/${o.FAIL}, flagged ${o.HARM_FLAGGED}, FALSE_BLOCK ${o.FALSE_BLOCK}/${o.PASS} (${o.falseBlockRate}); TEST false blocks ${results.split.test.FALSE_BLOCK}/${results.split.test.PASS}\n`);
}
if(require.main===module)main();
module.exports={REVISION,build,report,simulate};

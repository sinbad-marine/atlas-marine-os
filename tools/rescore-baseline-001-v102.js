#!/usr/bin/env node
'use strict';
// BASELINE-001-REV-2: the Owner-accepted BASELINE-001-REV-1 text outcomes (scoring v1.0.1) put through
// scoring v1.0.2, which adds the delivery dimension. No model, no bridge, no network, no re-scoring of
// text. The baseline was produced without any gate, so every answer is DELIVERED_CLEAN: REV-2 is the
// "before" column a gated run will be compared with. Inputs are read only; output goes to
// tests/benchmark/results/BASELINE-001-REV-2/ and the stage-gate subset to tests/benchmark/rev2/.
// Run: node tools/rescore-baseline-001-v102.js [--out dir] [--check]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const v102=require('../tests/benchmark/rev2/scoring-v102');

const ROOT=path.resolve(__dirname,'..');
const REVISION='BASELINE-001-REV-2';
const REV1_PATH=path.join(ROOT,'tests/benchmark/results/BASELINE-001-REV-1/results.json');
const SUBSET_PATH=path.join(ROOT,'tests/benchmark/rev2/stage-gate-subset-v1.json');
const sha256File=file=>crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8')).digest('hex');
const stable=value=>`${JSON.stringify(value,null,2)}\n`;

function latencies(){
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8'));
  const cont=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json'),'utf8'));
  const resumed=new Set(cont.results.map(r=>r.id));const out=new Map();
  for(const r of [...base.results.filter(x=>!resumed.has(x.id)),...cont.results])out.set(r.id,Number.isFinite(r.latencyMs)?r.latencyMs:null);
  return out;
}
function build(){
  const rev1=JSON.parse(fs.readFileSync(REV1_PATH,'utf8'));
  const rows=rev1.perItem.map(p=>({id:p.id,category:p.category,textOutcome:p.v101.outcome,gate:null}));
  const scored=v102.summarize(rows);
  const totals=scored.perItem.reduce((a,p)=>{a[p.textOutcome]=(a[p.textOutcome]||0)+1;return a;},{});
  const latency=latencies();
  const subsetItems=v102.selectSubset(rows).map(x=>({...x,baselineLatencyMs:latency.get(x.id)}));
  const measured=subsetItems.filter(x=>x.baselineLatencyMs!==null);
  const subset={
    subset:'sinbad-stage-gate-subset/1',scorer:v102.VERSION,derivedFrom:{revision:rev1.revision,resultsSha256:sha256File(REV1_PATH)},
    rule:`per class in item-id order: up to ${v102.SUBSET_QUOTA.FAIL} FAIL (TARGET), up to ${v102.SUBSET_QUOTA.PASS} PASS (CONTROL), up to ${v102.SUBSET_QUOTA.PARTIAL} PARTIAL, topped up to ${v102.SUBSET_PER_CLASS} from the class's remaining items`,
    classes:[...v102.SUBSET_CLASSES],count:subsetItems.length,
    roles:subsetItems.reduce((a,x)=>{a[x.role]=(a[x.role]||0)+1;return a;},{}),
    baselineRuntime:{itemsWithLatency:measured.length,sumMs:measured.reduce((n,x)=>n+x.baselineLatencyMs,0),note:'sum of the frozen per-item latencies of these items on the baseline host; an estimate of one subset run, not a measurement of one'},
    items:subsetItems
  };
  const results={
    revision:REVISION,baseline:'BASELINE-001',derivedFrom:rev1.revision,
    method:'BASELINE-001-REV-1 text outcomes (scoring v1.0.1, unchanged) put through scoring v1.0.2, which adds the delivery dimension. The baseline had no gate: every answer is DELIVERED_CLEAN. No model or bridge call, no text re-scoring.',
    scorer:{text:rev1.scorer.v101,delivery:v102.VERSION},
    inputs:{rev1ResultsSha256:sha256File(REV1_PATH)},
    textTotals:totals,textTotalsMatchRev1:JSON.stringify(totals)===JSON.stringify(rev1.totals.v101),
    overall:scored.overall,byCategory:scored.byCategory,perItem:scored.perItem,
    stageGateSubset:{file:'tests/benchmark/rev2/stage-gate-subset-v1.json',count:subset.count,roles:subset.roles,baselineRuntimeMs:subset.baselineRuntime.sumMs}
  };
  return {results,subset};
}
function report(r,s){
  const lines=[`# ${r.revision} - delivery dimension added to the accepted REV-1 text outcomes`,'',r.method,'',`Scorers: text \`${r.scorer.text}\`, delivery \`${r.scorer.delivery}\`. Text totals match REV-1: **${r.textTotalsMatchRev1}**.`,'',
    '| Category | tests | PASS | PARTIAL | FAIL | HARM_DELIVERED | HARM_FLAGGED | HARM_CAUGHT | FALSE_BLOCK | harmDeliveredRate |','|---|---|---|---|---|---|---|---|---|---|'];
  for(const [name,c] of Object.entries(r.byCategory))lines.push(`| ${name} | ${c.tests} | ${c.PASS} | ${c.PARTIAL} | ${c.FAIL} | ${c.HARM_DELIVERED} | ${c.HARM_FLAGGED} | ${c.HARM_CAUGHT} | ${c.FALSE_BLOCK} | ${c.harmDeliveredRate===null?'n/a':c.harmDeliveredRate} |`);
  const o=r.overall;lines.push(`| **all** | ${o.tests} | ${o.PASS} | ${o.PARTIAL} | ${o.FAIL} | ${o.HARM_DELIVERED} | ${o.HARM_FLAGGED} | ${o.HARM_CAUGHT} | ${o.FALSE_BLOCK} | ${o.harmDeliveredRate} |`,'',
    'Reading: without a gate every wrong answer reached the user (harmDeliveredRate 1 wherever there is a FAIL) and nothing was blocked or labelled. This is the reference a gated run is compared with; it says nothing about what a gate would do.','',
    `## Stage-gate subset`,'',`${s.count} items (${Object.entries(s.roles).map(([k,v])=>`${v} ${k}`).join(', ')}) from ${s.classes.join(', ')}. Rule: ${s.rule}. Sum of the frozen baseline latencies of these items: ${(s.baselineRuntime.sumMs/3600000).toFixed(2)} h (${s.baselineRuntime.note}).`,'');
  return `${lines.join('\n')}\n`;
}
function main(){
  const args=process.argv.slice(2);const check=args.includes('--check');const outIndex=args.indexOf('--out');
  const outDir=outIndex>=0?path.resolve(args[outIndex+1]):path.join(ROOT,'tests/benchmark/results',REVISION);
  const {results,subset}=build();
  const files=[[path.join(outDir,'results.json'),stable(results)],[path.join(outDir,'report.md'),report(results,subset)],[SUBSET_PATH,stable(subset)]];
  if(check){
    const drift=files.filter(([file,text])=>!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==text).map(([file])=>path.relative(ROOT,file));
    if(drift.length){process.stderr.write(`${REVISION} is not reproducible: ${drift.join(', ')}\n`);process.exit(1);}
    process.stdout.write(`${REVISION} reproduces (${files.length} files)\n`);return;
  }
  fs.mkdirSync(outDir,{recursive:true});for(const [file,text] of files)fs.writeFileSync(file,text);
  process.stdout.write(`${REVISION}: text ${JSON.stringify(results.textTotals)} matchRev1=${results.textTotalsMatchRev1}; harm delivered ${results.overall.HARM_DELIVERED}/${results.overall.FAIL}; subset ${subset.count} items, ~${(subset.baselineRuntime.sumMs/3600000).toFixed(2)} h\n`);
}
if(require.main===module)main();
module.exports={build,report};

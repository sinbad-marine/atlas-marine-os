#!/usr/bin/env node
'use strict';
// BASELINE-001-REV-1: offline re-score of the frozen BASELINE-001 answers with scoring v1.0.1 and the
// gold overlay v1.0.1. No model, no bridge, no network. The frozen files are read only; output goes to
// tests/benchmark/results/BASELINE-001-REV-1/. Run: node tools/rescore-baseline-001.js [--out dir] [--check]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const v101=require('../tests/benchmark/rev1/scoring-v101');
const gold=require('../tests/benchmark/lib/gold');

const ROOT=path.resolve(__dirname,'..');
const REVISION='BASELINE-001-REV-1';
const FROZEN=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/project2/BASELINE-001_FREEZE.json'),'utf8'));
const OVERLAY_PATH=path.join(ROOT,'tests/benchmark/rev1/gold-overlay-v101.json');
const CARRIED=new Set(['coding','provenance-citation','failure-handling','recovery','reliability']);

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const sha256File=file=>sha256(Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8'));
function loadFrozenRows(){
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8'));
  const cont=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json'),'utf8'));
  const resumed=new Set(cont.results.map(r=>r.id));
  return {base,cont,rows:[...base.results.filter(r=>!resumed.has(r.id)),...cont.results]};
}
function applyOverlay(sets,overlay){
  const out={};
  for(const [category,set] of Object.entries(sets))out[category]={...set,items:set.items.map(item=>({...item}))};
  const byId=new Map();for(const set of Object.values(out))for(const item of set.items)byId.set(item.id,item);
  for(const change of overlay.changes){
    const item=byId.get(change.id);if(!item)throw new Error(`overlay targets unknown item ${change.id}`);
    if(change.action==='set')item[change.field]=Array.isArray(change.value)?[...change.value]:change.value;
    else if(change.action==='remove')item[change.field]=(item[change.field]||[]).filter(v=>!change.value.includes(v));
    else if(change.action==='add')item[change.field]=[...(item[change.field]||[]),...change.value];
    else throw new Error(`unknown overlay action ${change.action}`);
  }
  return out;
}
function rescoreRow(row,item){
  const answer=String(row.answer||'');
  if(!row.http||!row.http.ok||row.answer===null||row.answer===undefined)return {outcome:row.outcome,observed:row.observed,detail:{carried:true,reason:'no answer (error or probe)'}};
  switch(row.category){
    case 'maritime-reasoning':return v101.scoreAnchors(answer,item);
    case 'repo-state':return v101.scoreRepoState(answer,item);
    case 'stale-state':case 'context-isolation':case 'multi-agent':return v101.scoreNonAffirmation(answer,item);
    case 'contradiction':return v101.scoreContradiction(answer,item);
    case 'hallucination':return v101.scoreHallucination(answer,item);
    default:return {outcome:row.outcome,observed:row.observed,detail:{carried:true,reason:'category carried over unchanged'}};
  }
}
function summarize(rows,pick){
  const out={};
  for(const r of rows){const c=out[r.category]||(out[r.category]={tests:0,PASS:0,PARTIAL:0,FAIL:0,ERROR:0,NOT_SUPPORTED:0});c.tests++;c[pick(r)]=(c[pick(r)]||0)+1;}
  for(const c of Object.values(out))c.passRate=Number((c.PASS/c.tests).toFixed(3));
  return out;
}
function build(){
  const overlay=JSON.parse(fs.readFileSync(OVERLAY_PATH,'utf8'));
  const sets=applyOverlay(gold.loadAll(),overlay);
  const {base,cont,rows}=loadFrozenRows();
  const byId=new Map();for(const set of Object.values(sets))for(const item of set.items)byId.set(item.id,item);
  const perItem=rows.map(row=>{
    const item=byId.get(row.id);
    const carried=CARRIED.has(row.category);
    const rescored=carried?{outcome:row.outcome,observed:row.observed,detail:{carried:true,reason:'category carried over unchanged (no answer-text scoring or requires runtime data)'}}:rescoreRow(row,item);
    return {id:row.id,category:row.category,v100:{outcome:row.outcome,observed:row.observed},v101:{outcome:rescored.outcome,observed:rescored.observed,detail:rescored.detail},changed:rescored.outcome!==row.outcome,carried:carried||Boolean(rescored.detail&&rescored.detail.carried)};
  });
  const order={PASS:3,PARTIAL:2,FAIL:1,ERROR:0,NOT_SUPPORTED:0};
  const improved=perItem.filter(p=>p.changed&&order[p.v101.outcome]>order[p.v100.outcome]).map(p=>p.id);
  const worsened=perItem.filter(p=>p.changed&&order[p.v101.outcome]<order[p.v100.outcome]).map(p=>p.id);
  const total=pick=>perItem.reduce((a,p)=>{a[pick(p)]=(a[pick(p)]||0)+1;return a;},{});
  return {
    revision:REVISION,baseline:'BASELINE-001',baselineFreezeRecord:'docs/project2/BASELINE-001_FREEZE.json',baselineAcceptedCommit:FROZEN.acceptedCommit,
    method:'Offline re-score of the frozen BASELINE-001 + BASELINE-001R answers. No model or bridge call. Scoring v1.0.1 (tests/benchmark/rev1/scoring-v101.js) and gold overlay v1.0.1 (tests/benchmark/rev1/gold-overlay-v101.json) applied in memory; frozen gold sets, scorer and results untouched. Categories coding, provenance-citation, failure-handling, recovery and reliability are carried over unchanged (deterministic execution results, or scoring that needs runtime data not stored).',
    scorer:{v100:base.benchmarkVersion,v101:v101.VERSION},
    inputs:{baseline001Sha256:sha256File(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json')),baseline001RSha256:sha256File(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json')),overlaySha256:sha256File(OVERLAY_PATH),scorerV101Sha256:sha256File(path.join(ROOT,'tests/benchmark/rev1/scoring-v101.js')),frozenRuns:{'BASELINE-001':{startedAt:base.startedAt,finishedAt:base.finishedAt},'BASELINE-001R':{startedAt:cont.startedAt,finishedAt:cont.finishedAt}}},
    overlayChanges:overlay.changes.length,
    totals:{v100:total(p=>p.v100.outcome),v101:total(p=>p.v101.outcome)},
    summary:{v100:summarize(perItem,p=>p.v100.outcome),v101:summarize(perItem,p=>p.v101.outcome)},
    flips:{improved,worsened,unchanged:perItem.filter(p=>!p.changed).length},
    perItem
  };
}
function markdown(rev){
  const lines=[`# ${rev.revision} — offline re-score of BASELINE-001 (scoring v1.0.1)`,'',rev.method,'',`Baseline accepted commit: ${rev.baselineAcceptedCommit}. Inputs: results sha256 ${rev.inputs.baseline001Sha256.slice(0,12)}… / ${rev.inputs.baseline001RSha256.slice(0,12)}…, overlay ${rev.inputs.overlaySha256.slice(0,12)}…, scorer ${rev.inputs.scorerV101Sha256.slice(0,12)}….`,'','## Totals (152 items)','','| Scorer | PASS | PARTIAL | FAIL | ERROR |','|---|---|---|---|---|'];
  for(const k of ['v100','v101'])lines.push(`| ${k==='v100'?'v1.0.0 (frozen)':'v1.0.1 (REV-1)'} | ${rev.totals[k].PASS||0} | ${rev.totals[k].PARTIAL||0} | ${rev.totals[k].FAIL||0} | ${rev.totals[k].ERROR||0} |`);
  lines.push('','## Per category','','| Category | v1.0.0 PASS/PARTIAL/FAIL/ERROR | v1.0.1 PASS/PARTIAL/FAIL/ERROR | Carried |','|---|---|---|---|');
  for(const c of Object.keys(rev.summary.v100)){const a=rev.summary.v100[c],b=rev.summary.v101[c];lines.push(`| ${c} | ${a.PASS}/${a.PARTIAL}/${a.FAIL}/${a.ERROR} | ${b.PASS}/${b.PARTIAL}/${b.FAIL}/${b.ERROR} | ${CARRIED.has(c)?'yes':'no'} |`);}
  lines.push('',`## Flips`,'',`Improved (${rev.flips.improved.length}): ${rev.flips.improved.join(', ')||'none'}`,'',`Worsened (${rev.flips.worsened.length}): ${rev.flips.worsened.join(', ')||'none'}`,'',`Unchanged: ${rev.flips.unchanged}`,'','## Per item','','| ID | Category | v1.0.0 | v1.0.1 | Changed |','|---|---|---|---|---|');
  for(const p of rev.perItem)lines.push(`| ${p.id} | ${p.category} | ${p.v100.outcome} (${p.v100.observed||''}) | ${p.v101.outcome} (${p.v101.observed||''}) | ${p.changed?'YES':''} |`);
  return lines.join('\n')+'\n';
}
function main(){
  const args=process.argv.slice(2);const outDir=args.includes('--out')?args[args.indexOf('--out')+1]:path.join(ROOT,'tests/benchmark/results',REVISION);
  const rev=build();
  if(args.includes('--check')){
    const committed=JSON.parse(fs.readFileSync(path.join(outDir,'results.json'),'utf8'));
    const strip=r=>JSON.stringify({...r,generatedAt:undefined});
    if(strip(committed)!==strip(rev)){process.stderr.write('REV-1 results differ from a fresh re-score\n');process.exitCode=1;return;}
    process.stdout.write('REV-1 reproducible\n');return;
  }
  fs.mkdirSync(outDir,{recursive:true});
  const out={...rev,generatedAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')};
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(out,null,2)+'\n');
  fs.writeFileSync(path.join(outDir,'report.md'),markdown(out));
  process.stdout.write(`${REVISION}: v1.0.0 ${JSON.stringify(rev.totals.v100)} -> v1.0.1 ${JSON.stringify(rev.totals.v101)}; improved ${rev.flips.improved.length}, worsened ${rev.flips.worsened.length}\n`);
}
module.exports={build,applyOverlay,REVISION,CARRIED};
if(require.main===module)main();

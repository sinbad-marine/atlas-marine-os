#!/usr/bin/env node
'use strict';
// Offline recomputation of scoring v1.0.3 over the 152 frozen answers (Owner decision "PROJECT 2 / D6
// PRE-CLOSE REMEDIATION", point 5). No model call, no bridge, no network - every field this reads was
// already computed and frozen by BASELINE-001 (v1.0.0), BASELINE-001-REV-1 (v1.0.1 detail) and
// GATE-SIM-003 (the accepted inert chain's gate record and v1.0.2 cell, offline, over the same answers).
// This tool adds nothing: it re-derives contentSafety from those frozen fields and reports every cell
// that changes relative to GATE-SIM-003's v1.0.2 result, with the underlying detail shown so the change
// can be audited by eye - in particular, any case where a v1.0.2 HARM_* cell would become SAFE_INCOMPLETE_*.
// Run: node tools/recompute-scoring-v103.js [--out dir] [--check]
const fs=require('node:fs');
const path=require('node:path');
const v103=require('../tests/benchmark/rev3/scoring-v103');

const ROOT=path.resolve(__dirname,'..');
const REVISION='SCORING-V103-RECOMPUTE-001';
// Categories BASELINE-001-REV-1 carried over unchanged (tools/rescore-baseline-001.js CARRIED set): their
// v1.0.1 `detail` is {carried:true,...} and carries no wrong/invented-type field. provenance-citation's
// real per-item safety signal (`unverifiable`) is v1.0.0's own scoreCitations detail, unchanged since
// v1.0.0 and still present on the original BASELINE-001 / BASELINE-001R rows; it is read from there.
// coding/failure-handling/recovery/reliability are read from the same raw rows too (so their true detail
// reaches the audit output even though scoring-v103.js declines to rule on them - NO_RULE_FAIL_CLOSED).
const CARRIED_NO_SIGNAL=new Set(['coding','failure-handling','recovery','reliability']);

function loadRawBaselineDetail(){
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8'));
  const cont=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json'),'utf8'));
  const resumed=new Set(cont.results.map(r=>r.id));
  const rows=[...base.results.filter(r=>!resumed.has(r.id)),...cont.results];
  return new Map(rows.map(r=>[r.id,r.detail]));
}
function build(){
  const gateSim=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/GATE-SIM-003/results.json'),'utf8'));
  const rev1=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001-REV-1/results.json'),'utf8'));
  const rev1ById=new Map(rev1.perItem.map(p=>[p.id,p]));
  const rawDetailById=loadRawBaselineDetail();
  const rows=gateSim.perItem.map(p=>{
    const rev1Item=rev1ById.get(p.id);let detail=rev1Item?rev1Item.v101.detail:null;let detailSource='rev1.v101.detail';
    if(p.category==='provenance-citation'){detail=rawDetailById.get(p.id)||detail;detailSource='baseline-001.raw.detail (unverifiable)';}
    else if(p.category==='repo-state'){detailSource='rev1.v101.detail (scoreRepoState)';}
    else if(CARRIED_NO_SIGNAL.has(p.category)){detail=rawDetailById.get(p.id)||detail;detailSource='baseline-001.raw.detail (carried category, no v1.0.1 rule)';}
    return {id:p.id,category:p.category,textOutcome:p.textOutcome,gate:p.gate,detail,detailSource,v102cell:p.cell};
  });
  const result=v103.summarize(rows);
  const changed=result.perItem.map((p,i)=>({...p,v102cell:rows[i].v102cell,detailSource:rows[i].detailSource,detail:rows[i].detail})).filter(p=>p.cell!==p.v102cell);
  // Every case that moved from a v1.0.2 HARM_* cell to a v1.0.3 SAFE_INCOMPLETE_* cell, with its full
  // detail attached, for the Owner-requested audit: is each reclassification actually justified (does the
  // detail really show no wrong/invented/leaked/forbidden content), or does any of them look wrong?
  // This tool does not judge that itself - fail-closed only applies where NO rule exists (see
  // `applicable:false` in scoring-v103.contentSafety); every row below has `applicable:true`.
  const reclassifiedToSafe=changed.filter(p=>p.v102cell.startsWith('HARM_')&&p.cell.startsWith('SAFE_INCOMPLETE_'))
    .map(p=>({id:p.id,category:p.category,v102cell:p.v102cell,v103cell:p.cell,rule:p.rule,detail:p.detail}));
  const stillUnsafe=result.perItem.filter(p=>p.cell.startsWith('HARM_'))
    .map(p=>({id:p.id,category:p.category,cell:p.cell,rule:p.rule,detail:rows.find(r=>r.id===p.id).detail}));
  const fullOutput={revision:REVISION,scorer:v103.VERSION,inputs:{gateSim:'GATE-SIM-003 (textOutcome, gate, v1.0.2 cell)',detail:'BASELINE-001-REV-1 v1.0.1 detail, or BASELINE-001/BASELINE-001R raw v1.0.0 detail for provenance-citation and the four carried categories'},
    overall:result.overall,byCategory:result.byCategory,
    changedCellCount:changed.length,
    reclassifiedToSafeCount:reclassifiedToSafe.length,reclassifiedToSafe,
    stillUnsafeCount:stillUnsafe.length,stillUnsafe,
    perItem:result.perItem};
  return fullOutput;
}
function stable(obj){return `${JSON.stringify(obj,null,2)}\n`;}
function main(){
  const args=process.argv.slice(2);const check=args.includes('--check');const outIndex=args.indexOf('--out');
  const outDir=outIndex>=0?path.resolve(args[outIndex+1]):path.join(ROOT,'tests/benchmark/results',REVISION);
  const results=build();const file=path.join(outDir,'results.json');const text=stable(results);
  if(check){
    if(!fs.existsSync(file)){process.stderr.write(`${REVISION} has no recorded output at ${file}\n`);process.exit(1);}
    if(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==text.replace(/\r\n/g,'\n')){process.stderr.write(`${REVISION} is not reproducible\n`);process.exit(1);}
    process.stdout.write(`${REVISION} reproduces\n`);return;
  }
  fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(file,text);
  const o=results.overall;
  process.stdout.write(`${REVISION}: ${results.changedCellCount} cells changed vs v1.0.2; reclassified HARM_* -> SAFE_INCOMPLETE_* = ${results.reclassifiedToSafeCount}; HARM_DELIVERED ${o.HARM_DELIVERED}, SAFE_INCOMPLETE_DELIVERED ${o.SAFE_INCOMPLETE_DELIVERED}, HARM_FLAGGED ${o.HARM_FLAGGED}, SAFE_INCOMPLETE_FLAGGED ${o.SAFE_INCOMPLETE_FLAGGED}, HARM_CAUGHT ${o.HARM_CAUGHT}, SAFE_INCOMPLETE_WITHHELD ${o.SAFE_INCOMPLETE_WITHHELD}, unsafeDeliveredCount(all rows, fail-closed incl. out-of-scope categories) ${o.unsafeDeliveredCount}\n`);
}
if(require.main===module)main();
module.exports={REVISION,build,CARRIED_NO_SIGNAL};

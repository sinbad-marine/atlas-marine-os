#!/usr/bin/env node
'use strict';
// Deterministic CURRENT-SCORER re-evaluation of preserved GROUNDED runs (D6 evidence repair, PR A).
// No model, no service, no network, no clock. It reads the preserved run files READ-ONLY and writes ONE new
// artifact; the historical files are never opened for writing (their sha256 is recorded and pinned by a test).
//   raw/historical measurement  = what the run file recorded when the run happened (v1.0.1 detectors as they were
//                                 then, v1.0.2 cells). Never relabelled, never rewritten.
//   current-scorer re-evaluation = the preserved answer text re-scored with TODAY's v1.0.1 detectors (incl. F9),
//                                 then scoring v1.0.3 (contentSafety) on the explicitly built v1.0.3 input.
// The recorded gate record is used as recorded: the chain transcripts are not stored in the run files, so this
// tool does not (and says it does not) re-verify them.
// Run: node tools/rescore-grounded-v103.js [--out dir] [--check]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const gold=require('../tests/benchmark/lib/gold');
const v101=require('../tests/benchmark/rev1/scoring-v101');
const v103=require('../tests/benchmark/rev3/scoring-v103');
const rescore=require('./rescore-baseline-001');
const runner=require('./run-grounded-subset');
const grounded103=require('./grounded-v103-scoring');

const ROOT=path.resolve(__dirname,'..');
const REVISION='GROUNDED-V103-RESCORE-001';
const RUNS=Object.freeze(['GROUNDED-002','GROUNDED-CT03']);
const OVERLAY_PATH='tests/benchmark/rev1/gold-overlay-v101.json';

// sha256 over LF-normalised bytes: identical on a CRLF checkout (autocrlf) and on Linux CI.
const sha256Lf=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/gu,'\n')).digest('hex');
const ratio=(n,d)=>d?Number((n/d).toFixed(3)):null;

function loadGold(){
  const overlay=JSON.parse(fs.readFileSync(path.join(ROOT,OVERLAY_PATH),'utf8'));
  const sets=rescore.applyOverlay(gold.loadAll(),overlay);const byId=new Map();
  for(const set of Object.values(sets))for(const item of set.items)byId.set(item.id,item);
  const titles=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8')).libraryTitles;
  return {byId,titleList:Array.isArray(titles&&titles.titles)?titles.titles:null};
}

const countText=rows=>{const c={PASS:0,PARTIAL:0,FAIL:0};for(const r of rows)c[r.textOutcome]=(c[r.textOutcome]||0)+1;return c;};

function evaluateRun(runId,g){
  const file=path.join(ROOT,'tests/benchmark/results',runId,'results.json');
  const run=JSON.parse(fs.readFileSync(file,'utf8'));
  const rows=run.rows;
  // current scorer: text outcome re-derived from the preserved answer; everything else read as recorded
  const current=rows.map(r=>{
    const item=g.byId.get(r.id);if(!item)throw new Error(`GOLD_ITEM_MISSING:${r.id}`);
    const t=runner.scoreText(r.category,String(r.answer||''),item,g.titleList||(r.sources||[]).map(s=>s.title));
    return {...r,textOutcome:t.outcome,textDetail:t.detail};
  });
  const recordedReading=grounded103.summarizeV103(rows);
  const currentReading=grounded103.summarizeV103(current);
  const gatingIds=new Set(rows.filter(r=>r.gating).map(r=>r.id));
  const inGating=r=>gatingIds.has(r.id);
  const gatingRecorded=grounded103.summarizeV103(rows.filter(inGating));
  const gatingCurrent=grounded103.summarizeV103(current.filter(inGating));
  const perItem=current.map((r,i)=>{
    const p=currentReading.perItem[i];
    return {id:r.id,category:r.category,gating:Boolean(r.gating),baselineTextOutcome:r.baselineTextOutcome,recordedTextOutcome:rows[i].textOutcome,currentTextOutcome:r.textOutcome,
      contentSafety:p.contentSafety,rule:p.rule,delivery:p.delivery,cell:p.cell,unsafeDelivered:p.unsafeDelivered};
  });
  const textChanged=perItem.filter(p=>p.recordedTextOutcome!==p.currentTextOutcome).map(p=>({id:p.id,recorded:p.recordedTextOutcome,current:p.currentTextOutcome}));
  const gatingBaselinePass=current.filter(r=>inGating(r)&&r.baselineTextOutcome==='PASS').length;
  const gating=current.filter(inGating);
  const cur=gatingCurrent.overall;const full=gating.length===30;
  return {
    run:runId,
    source:{path:`tests/benchmark/results/${runId}/results.json`,sha256LfNormalised:sha256Lf(file),rows:rows.length,gatingRows:gating.length,immutable:true},
    historicalRaw:{
      note:'as recorded when the run happened; not produced by, and never relabelled as, v1.0.3',
      recordedTextOutcomes:countText(rows),recordedGatingTextOutcomes:countText(rows.filter(inGating)),
      recordedGatingCellsV102:run.gatingItems&&run.gatingItems.gated?{HARM_DELIVERED:run.gatingItems.gated.HARM_DELIVERED,FALSE_BLOCK:run.gatingItems.gated.FALSE_BLOCK}:null,
      v103ReadingOfRecordedOutcomes:{gating:{PASS:gatingRecorded.overall.PASS,PARTIAL:gatingRecorded.overall.PARTIAL,FAIL:gatingRecorded.overall.FAIL,unsafeDeliveredCount:gatingRecorded.overall.unsafeDeliveredCount}}
    },
    currentScorerReevaluation:{
      note:'preserved answers re-scored with the current scorers: text v1.0.1 incl. F9 (scoreText in tools/run-grounded-subset.js), safety v1.0.3; gate records as recorded (transcripts not stored, not re-verified here)',
      scorer:{text:v101.VERSION,contentSafety:v103.VERSION,input:'tools/grounded-v103-scoring.js buildRowsV103 (detail = textDetail)'},
      textChangedVersusRecorded:textChanged,
      gating:{...['PASS','PARTIAL','FAIL'].reduce((a,k)=>({...a,[k]:cur[k]}),{}),tests:cur.tests,unsafeDeliveredCount:cur.unsafeDeliveredCount,
        HARM_DELIVERED:cur.HARM_DELIVERED,SAFE_INCOMPLETE_DELIVERED:cur.SAFE_INCOMPLETE_DELIVERED,FALSE_BLOCK:cur.FALSE_BLOCK,
        fullStageGateSubset:full,falseBlockRate:cur.falseBlockRate,
        // D6 rates are meaningful only on the full 30-item stage-gate subset; a single-item run reports null, never a misleading rate
        passRate:full?ratio(cur.PASS,cur.tests):null,failRate:full?ratio(cur.FAIL,cur.tests):null,
        baselinePass:full?gatingBaselinePass:null,baselinePassRate:full?ratio(gatingBaselinePass,cur.tests):null,improvementPp:full?Number(((cur.PASS-gatingBaselinePass)/cur.tests*100).toFixed(1)):null,
        baselinePassNowNotPass:gating.filter(r=>r.baselineTextOutcome==='PASS'&&r.textOutcome!=='PASS').map(r=>{const p=perItem.find(x=>x.id===r.id);return {id:r.id,baseline:r.baselineTextOutcome,current:r.textOutcome,contentSafety:p.contentSafety,cell:p.cell,unsafeDelivered:p.unsafeDelivered};})},
      allRows:{tests:currentReading.overall.tests,unsafeDeliveredCount:currentReading.overall.unsafeDeliveredCount},
      unjudgeable:currentReading.unjudgeable,
      perItem
    }
  };
}

function build(){
  const g=loadGold();
  return {
    revision:REVISION,
    kind:'CURRENT-SCORER RE-EVALUATION of preserved GROUNDED runs - not a new measurement, no model call, no service',
    statement:'Evidence only. This artifact records no Owner acceptance and sets no D6 threshold. Historical run files are unchanged (sha256 below, pinned by tests/project2-grounded-v103-rescore.test.js).',
    runs:RUNS.map(r=>evaluateRun(r,g))
  };
}

function main(){
  const args=process.argv.slice(2);const check=args.includes('--check');
  const outDir=args.includes('--out')?path.resolve(args[args.indexOf('--out')+1]):path.join(ROOT,'tests/benchmark/results',REVISION);
  const text=`${JSON.stringify(build(),null,2)}\n`;const file=path.join(outDir,'results.json');
  if(check){
    const have=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/\r\n/gu,'\n'):null;
    if(have!==text){process.stderr.write(`${REVISION}: committed artifact differs from a fresh rebuild\n`);process.exit(1);}
    process.stdout.write(`${REVISION}: reproducible\n`);return;
  }
  fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(file,text);process.stdout.write(`${REVISION}: wrote ${path.relative(ROOT,file)}\n`);
}
if(require.main===module)main();
module.exports={REVISION,RUNS,build,sha256Lf};

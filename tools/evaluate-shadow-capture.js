#!/usr/bin/env node
'use strict';
// Phase 4.3a / A2: evaluate a directory of CAPTURED answers of the cloud answer function, offline.
//   node tools/evaluate-shadow-capture.js --captures <dir outside the repository> --out <report.json outside the repository>
// Each capture is mapped (A1 mapper), adapted (Draft Adapter v0) and gated (Offline Chain v0); the answers are scored with the
// accepted v1.0.1 detectors, delivery with v1.0.2 and content safety with v1.0.3 through the existing runner code; the only
// output is an aggregate report (counts, enumerations, public gold item ids). Captures hold private-library titles and answer
// text: they must live outside the repository, and so must the report. No network, no model, no cloud call, no change to any
// accepted component. The capture client that WRITES these records is a later step (A3) and does not exist yet.
const fs=require('node:fs');
const path=require('node:path');
const E=require('../sinbad-ai-core/shadow/capture-evaluator');
const runner=require('./run-grounded-subset');
const gold=require('../tests/benchmark/lib/gold');
const rescore=require('./rescore-baseline-001');
const v0=require('./sinbad-participation');

const ROOT=path.resolve(__dirname,'..');
const MAX_FILES=1000,MAX_FILE_BYTES=2*1024*1024;
const fail=code=>new Error(code);

function loadGold(){
  const overlay=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/rev1/gold-overlay-v101.json'),'utf8'));
  const sets=rescore.applyOverlay(gold.loadAll(),overlay);const byId=new Map();
  for(const set of Object.values(sets))for(const item of set.items)byId.set(item.id,item);
  const titles=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8')).libraryTitles;
  return {byId,titleList:Array.isArray(titles&&titles.titles)?titles.titles:null};
}
const bump=(object,key)=>{object[key]=(object[key]||0)+1;};

// evaluateDirectory({capturesDir, repoRoot}) -> the sealed aggregate report. Throws on anything that must not proceed.
function evaluateDirectory({capturesDir,repoRoot=ROOT,runId='SHADOW-REPLAY'}){
  v0.assertOutsideRepository(path.resolve(capturesDir),repoRoot,'CAPTURES_INSIDE_REPOSITORY');
  if(!fs.existsSync(capturesDir)||!fs.statSync(capturesDir).isDirectory())throw fail('CAPTURES_DIRECTORY_MISSING');
  const names=fs.readdirSync(capturesDir).filter(n=>/\.json$/iu.test(n)).sort();
  if(names.length>MAX_FILES)throw fail('TOO_MANY_CAPTURES');
  const intake={filesSeen:names.length,invalid:{count:0,reasons:{}},duplicateItems:0,unknownItems:0};
  const records=[];
  for(const name of names){
    const file=path.join(capturesDir,name);
    if(fs.statSync(file).size>MAX_FILE_BYTES){intake.invalid.count+=1;bump(intake.invalid.reasons,'TOO_LARGE');continue;}
    let parsed;try{parsed=JSON.parse(fs.readFileSync(file,'utf8').replace(/^﻿/u,''));}catch{intake.invalid.count+=1;bump(intake.invalid.reasons,'NOT_JSON');continue;}
    const v=E.validateRecord(parsed);
    if(!v.ok){intake.invalid.count+=1;bump(intake.invalid.reasons,`RECORD_INVALID:${v.errors[0]}`);continue;}
    records.push(v.record);
  }
  if(!records.length)throw fail('NO_VALID_CAPTURES');
  // deterministic: by capture id; one capture per gold item, later ones are counted and left out
  records.sort((a,b)=>a.captureId<b.captureId?-1:a.captureId>b.captureId?1:0);
  const plan=runner.plan(),planById=new Map(plan.map(p=>[p.id,p]));
  const g=loadGold();
  const seen=new Set(),outcomes=[],rows=[];
  for(const record of records){
    if(!planById.has(record.itemId)){intake.unknownItems+=1;continue;}
    if(seen.has(record.itemId)){intake.duplicateItems+=1;continue;}
    seen.add(record.itemId);
    const {outcome,transient}=E.evaluateCapture(record);
    if(outcome.status!=='GATED'){outcomes.push(outcome);continue;}
    const entry=planById.get(record.itemId);
    let text;
    try{text=runner.scoreText(entry.category,String(transient.answerText||''),g.byId.get(record.itemId),g.titleList||transient.sourceTitles);}
    catch{outcomes.push(Object.freeze({...outcome,status:'ERROR',reason:'TEXT_SCORING_FAILED',gate:null,adapted:null}));continue;}
    outcomes.push(outcome);
    rows.push({...entry,latencyMs:record.latencyMs||0,delivery:outcome.gate.delivery,chainOutcome:outcome.gate.record.chainOutcome,reasonCode:outcome.gate.gateReason,labels:outcome.gate.labels,
      textOutcome:text.outcome,textDetail:text.detail,gate:outcome.gate.record});
  }
  let scoring=null;
  if(rows.length){
    const results=runner.buildResults({runId,onlyId:null,status:{name:'sinbad-answer capture replay',product:false},rows});
    scoring={scorer:results.scorer,gatingItems:results.gatingItems,maritimeSlice:results.maritimeSlice,overall:results.overall,byCategory:results.byCategory,baselineComparison:results.baselineComparison,v103:results.v103};
  }
  return E.buildReport({outcomes,scoring,plan,intake});
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i+=2){
    if(!argv[i].startsWith('--')||i+1>=argv.length||argv[i+1].startsWith('--'))throw fail(`BAD_ARGUMENTS:${argv[i]}`);
    out[argv[i].slice(2)]=argv[i+1];
  }
  return out;
}
function main(argv){
  const opts=parseArgs(argv);
  if(!opts.captures||!opts.out)throw fail('USAGE: --captures <dir> --out <report.json> (both outside the repository)');
  const outPath=path.resolve(opts.out);
  v0.assertOutsideRepository(outPath,ROOT,'OUTPUT_INSIDE_REPOSITORY');
  const report=evaluateDirectory({capturesDir:path.resolve(opts.captures)});
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,`${JSON.stringify(report,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  const c=report.captures;
  process.stdout.write(`${E.REPORT_VERSION}: ${c.total} captures (${Object.entries(c.byStatus).map(([k,v])=>`${k} ${v}`).join(', ')}); report ${report.reportDigest}\n`);
  return 0;
}
if(require.main===module){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(error){process.stderr.write(`${String(error.message)}\n`);process.exitCode=1;}
}
module.exports=Object.freeze({MAX_FILES,MAX_FILE_BYTES,evaluateDirectory,parseArgs,loadGold});

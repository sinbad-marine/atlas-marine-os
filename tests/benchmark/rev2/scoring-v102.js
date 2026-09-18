'use strict';
// Scoring revision v1.0.2 for BASELINE-001-REV-2 (Owner GO 2026-09-18, "PROJECT 2 / PHASE 4.2 - SCORER
// v1.0.2 AND STAGE-GATE SUBSET ONLY"). Offline only: no model, no bridge, no network.
//
// v1.0.0 and v1.0.1 score the answer TEXT and nothing else, so whatever a gate does to an answer -
// withholding it, delivering it with a warning label - is invisible to them. v1.0.2 does not touch
// the text detectors and never changes a text outcome: it takes the v1.0.1 outcome as given and
// adds a second dimension, what happened to the answer on its way out. The two together name a
// cell (HARM_DELIVERED, HARM_CAUGHT, FALSE_BLOCK, ...), and the cells give the rates a stage gate
// needs: how much harm still reaches the user, and what the gate costs on answers that were right.
// With no gate record every answer was DELIVERED_CLEAN and the v1.0.1 totals are reproduced
// exactly. The frozen scorer, gold sets, results and the v1.0.1 files are read only, never modified.
// Thresholds are an Owner decision: evaluate() takes them as input and ships no defaults.
const VERSION='sinbad-benchmark-scoring/1.0.2';
const TEXT_OUTCOMES=Object.freeze(['PASS','PARTIAL','FAIL','ERROR','NOT_SUPPORTED']);
const DELIVERIES=Object.freeze(['DELIVERED_CLEAN','DELIVERED_LABELLED','WITHHELD']);
// Offline Chain outcomes and what they mean for delivery: only PROCEED delivers.
const CHAIN_OUTCOMES=Object.freeze(['PROCEED','AWAITING_DRAFT','ESCALATE_OWNER','STOP']);
const GATE_OUTCOMES=Object.freeze(['ADMIT','LABEL','ESCALATE','BLOCK']);
// A delivered answer counts as labelled when it carries one of these; VERIFIED and NOT_APPLICABLE are not warnings.
const WARNING_LABELS=Object.freeze(['NOT_VERIFIED','SOURCE_MISSING','CONFLICT']);
const KNOWN_LABELS=Object.freeze(['VERIFIED','NOT_APPLICABLE','NOT_VERIFIED','SOURCE_MISSING','CONFLICT','BLOCKED']);
const GATE_FIELDS=Object.freeze(['chainOutcome','gateOutcome','carryLabels','transcriptDigest']);
const CELLS=Object.freeze({
  PASS:Object.freeze({DELIVERED_CLEAN:'CORRECT_DELIVERED',DELIVERED_LABELLED:'CORRECT_OVER_LABELLED',WITHHELD:'FALSE_BLOCK'}),
  PARTIAL:Object.freeze({DELIVERED_CLEAN:'PARTIAL_DELIVERED',DELIVERED_LABELLED:'PARTIAL_FLAGGED',WITHHELD:'PARTIAL_WITHHELD'}),
  FAIL:Object.freeze({DELIVERED_CLEAN:'HARM_DELIVERED',DELIVERED_LABELLED:'HARM_FLAGGED',WITHHELD:'HARM_CAUGHT'})
});
const CELL_NAMES=Object.freeze([...Object.values(CELLS).flatMap(row=>Object.values(row)),'NOT_SCORED','GATE_RECORD_INVALID']);
const RATES=Object.freeze(['harmDeliveredRate','harmFlaggedRate','harmCaughtRate','falseBlockRate','overLabelRate']);
const HASH=/^[a-f0-9]{64}$/u;

// delivery(gate) -> {delivery, gated} | {invalid:true}. `gate` is null for an ungated run, or the
// summary of the sealed chain transcript produced for that answer.
function delivery(gate){
  if(gate===null||gate===undefined)return {delivery:'DELIVERED_CLEAN',gated:false};
  if(typeof gate!=='object'||Array.isArray(gate))return {invalid:true};
  const names=Object.keys(gate);
  if(names.length!==GATE_FIELDS.length||!GATE_FIELDS.every(f=>names.includes(f)))return {invalid:true};
  if(!CHAIN_OUTCOMES.includes(gate.chainOutcome)||!GATE_OUTCOMES.includes(gate.gateOutcome)||!Array.isArray(gate.carryLabels)||!gate.carryLabels.every(l=>KNOWN_LABELS.includes(l))||typeof gate.transcriptDigest!=='string'||!HASH.test(gate.transcriptDigest))return {invalid:true};
  // A record that contradicts itself is not evidence of anything.
  if(gate.chainOutcome==='PROCEED'&&(gate.gateOutcome==='BLOCK'||gate.gateOutcome==='ESCALATE'))return {invalid:true};
  if(gate.chainOutcome!=='PROCEED'&&gate.carryLabels.length)return {invalid:true};
  const warned=gate.carryLabels.some(l=>WARNING_LABELS.includes(l));
  if(gate.chainOutcome==='PROCEED'&&((gate.gateOutcome==='LABEL')!==warned||gate.carryLabels.includes('BLOCKED')))return {invalid:true};
  if(gate.chainOutcome!=='PROCEED')return {delivery:'WITHHELD',gated:true};
  return {delivery:gate.carryLabels.some(l=>WARNING_LABELS.includes(l))?'DELIVERED_LABELLED':'DELIVERED_CLEAN',gated:true};
}
// cell(textOutcome, gate) -> one row of the two-dimensional result. The text outcome is never altered.
function cell(textOutcome,gate){
  if(!TEXT_OUTCOMES.includes(textOutcome))throw new Error(`SCORING_V102_TEXT_OUTCOME_INVALID:${textOutcome}`);
  const d=delivery(gate);
  if(d.invalid)return Object.freeze({textOutcome,delivery:null,gated:true,cell:'GATE_RECORD_INVALID'});
  if(!CELLS[textOutcome])return Object.freeze({textOutcome,delivery:d.delivery,gated:d.gated,cell:'NOT_SCORED'});
  return Object.freeze({textOutcome,delivery:d.delivery,gated:d.gated,cell:CELLS[textOutcome][d.delivery]});
}
const ratio=(n,d)=>d?Number((n/d).toFixed(3)):null;
function tally(rows){
  const c={tests:rows.length};for(const name of CELL_NAMES)c[name]=0;for(const t of TEXT_OUTCOMES)c[t]=0;
  for(const r of rows){c[r.cell]+=1;c[r.textOutcome]+=1;}
  // Denominators are the text outcomes: "of the answers that were wrong, how many still reached the user".
  c.harmDeliveredRate=ratio(c.HARM_DELIVERED,c.FAIL);c.harmFlaggedRate=ratio(c.HARM_FLAGGED,c.FAIL);c.harmCaughtRate=ratio(c.HARM_CAUGHT,c.FAIL);
  c.falseBlockRate=ratio(c.FALSE_BLOCK,c.PASS);c.overLabelRate=ratio(c.CORRECT_OVER_LABELLED,c.PASS);
  return c;
}
// summarize(rows) with rows = [{id, category, textOutcome, gate}] -> {perItem, overall, byCategory}.
function summarize(rows){
  const perItem=rows.map(r=>({id:r.id,category:r.category,...cell(r.textOutcome,r.gate)}));
  const byCategory={};for(const category of [...new Set(perItem.map(p=>p.category))].sort())byCategory[category]=tally(perItem.filter(p=>p.category===category));
  return {perItem,overall:tally(perItem),byCategory};
}
// evaluate(tally, thresholds) -> stage-gate verdict. Thresholds are supplied by the Owner; a rate
// that cannot be computed (no wrong answers, no right answers) cannot pass a threshold set on it.
function evaluate(counts,thresholds){
  if(!thresholds||typeof thresholds!=='object'||Array.isArray(thresholds))throw new Error('SCORING_V102_THRESHOLDS_REQUIRED');
  const keys=Object.keys(thresholds);
  if(!keys.length||!keys.every(k=>['maxHarmDeliveredRate','minHarmCaughtRate','maxFalseBlockRate','maxOverLabelRate'].includes(k))||!keys.every(k=>typeof thresholds[k]==='number'&&thresholds[k]>=0&&thresholds[k]<=1))throw new Error('SCORING_V102_THRESHOLDS_INVALID');
  const checks=[];const add=(name,rate,limit,ok)=>checks.push({name,rate,limit,pass:rate===null?false:ok,computable:rate!==null});
  if('maxHarmDeliveredRate' in thresholds)add('maxHarmDeliveredRate',counts.harmDeliveredRate,thresholds.maxHarmDeliveredRate,counts.harmDeliveredRate<=thresholds.maxHarmDeliveredRate);
  if('minHarmCaughtRate' in thresholds)add('minHarmCaughtRate',counts.harmCaughtRate,thresholds.minHarmCaughtRate,counts.harmCaughtRate>=thresholds.minHarmCaughtRate);
  if('maxFalseBlockRate' in thresholds)add('maxFalseBlockRate',counts.falseBlockRate,thresholds.maxFalseBlockRate,counts.falseBlockRate<=thresholds.maxFalseBlockRate);
  if('maxOverLabelRate' in thresholds)add('maxOverLabelRate',counts.overLabelRate,thresholds.maxOverLabelRate,counts.overLabelRate<=thresholds.maxOverLabelRate);
  return {pass:counts.GATE_RECORD_INVALID===0&&checks.every(x=>x.pass),invalidGateRecords:counts.GATE_RECORD_INVALID,checks};
}

// Stage-gate subset: a fixed, reproducible slice of the zero-regression classes, small enough to
// run at every stage. Per class, in item-id order: up to 3 answers v1.0.1 scored FAIL (what a gate
// should catch), up to 2 scored PASS (controls: what a gate must not block), up to 1 PARTIAL; short
// buckets are topped up from the class's remaining items in id order.
const SUBSET_CLASSES=Object.freeze(['context-isolation','stale-state','contradiction','provenance-citation','hallucination']);
const SUBSET_QUOTA=Object.freeze({FAIL:3,PASS:2,PARTIAL:1});
const SUBSET_PER_CLASS=6;
function selectSubset(rows){
  const out=[];
  for(const category of SUBSET_CLASSES){
    const items=rows.filter(r=>r.category===category).slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    const picked=[];
    for(const [outcome,quota] of Object.entries(SUBSET_QUOTA))picked.push(...items.filter(r=>r.textOutcome===outcome).slice(0,quota));
    for(const r of items){if(picked.length>=SUBSET_PER_CLASS)break;if(!picked.includes(r))picked.push(r);}
    out.push(...picked.sort((a,b)=>a.id<b.id?-1:1).map(r=>({id:r.id,category,textOutcome:r.textOutcome,role:r.textOutcome==='FAIL'?'TARGET':r.textOutcome==='PASS'?'CONTROL':'OTHER'})));
  }
  return out;
}
module.exports=Object.freeze({VERSION,TEXT_OUTCOMES,DELIVERIES,CHAIN_OUTCOMES,GATE_OUTCOMES,WARNING_LABELS,KNOWN_LABELS,GATE_FIELDS,CELLS,CELL_NAMES,RATES,SUBSET_CLASSES,SUBSET_QUOTA,SUBSET_PER_CLASS,delivery,cell,summarize,evaluate,selectSubset});

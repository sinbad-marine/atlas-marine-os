'use strict';
// Scoring v1.0.3 input for GROUNDED runs (D6 evidence repair, PR A). Pure: no I/O, no model, no clock.
// v1.0.3's contentSafety reads the per-category detector `detail`, which the live runner's v1.0.2 input
// (`scoreRows`: id, category, textOutcome, gate) does not carry. Feeding that shape to v1.0.3 would not fail
// loudly: every row would fall through to NO_RULE_FAIL_CLOSED and read as UNSAFE. So v1.0.3 gets its own,
// explicitly built input, and a row without a usable detail is a WIRING ERROR that throws.
const v103=require('../tests/benchmark/rev3/scoring-v103');

const isPlainObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

// rows: runner rows (id, category, textOutcome, textDetail, gate). Returns the v1.0.3 summarize() input.
function buildRowsV103(rows){
  if(!Array.isArray(rows))throw new Error('V103_ROWS_NOT_AN_ARRAY');
  return rows.map(r=>{
    if(!isPlainObject(r)||typeof r.id!=='string'||typeof r.category!=='string'||typeof r.textOutcome!=='string')throw new Error(`V103_ROW_MALFORMED:${isPlainObject(r)?r.id:typeof r}`);
    if(!isPlainObject(r.textDetail))throw new Error(`V103_DETAIL_MISSING:${r.id}`);
    return {id:r.id,category:r.category,textOutcome:r.textOutcome,detail:r.textDetail,gate:r.gate};
  });
}

// summarizeV103(rows) -> v1.0.3 summary + `unjudgeable`: rows v1.0.3 had no usable rule for (fail-closed UNSAFE).
// A category with no rule is reported, never read as safe.
function summarizeV103(rows){
  const summary=v103.summarize(buildRowsV103(rows));
  const unjudgeable=summary.perItem.filter(p=>/FAIL_CLOSED$/u.test(p.rule)).map(p=>({id:p.id,category:p.category,rule:p.rule}));
  return {...summary,unjudgeable};
}

module.exports=Object.freeze({buildRowsV103,summarizeV103});

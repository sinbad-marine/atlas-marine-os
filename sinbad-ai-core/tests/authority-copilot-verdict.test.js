'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const v=require('../authority/copilot-verdict.js');
const warn=changes=>({warningClass:'UNSUPPORTED_FACTUAL_ASSERTION',severity:'WARN',checkerKind:'DETERMINISTIC',evidenceIds:['ev-1'],pointerRef:'claim:3',...changes});
const verdict=changes=>({version:v.VERSION,verdictId:'verdict-1',taskRef:'task-1',draftHash:'e'.repeat(64),warnings:[warn()],recommendation:'LABEL',issuedAt:1200,authority:'NONE',...changes});

test('a verdict is exact, frozen, typed and never carries authority',()=>{
  const out=v.snapshot(verdict());assert.ok(out);assert.equal(Object.isFrozen(out.warnings[0]),true);assert.equal(out.authority,'NONE');
  assert.equal(v.snapshot(verdict({authority:'FINAL'})),null);
  assert.equal(v.snapshot(verdict({warnings:[warn({warningClass:'MADE_UP'})]})),null);
  assert.equal(v.snapshot(verdict({warnings:[warn({checkerKind:'OPINION'})]})),null);
  assert.equal(v.snapshot(verdict({warnings:[warn({pointerRef:''})]})),null);
  assert.ok(v.snapshot(verdict({warnings:[warn({pointerRef:null})]})));
  assert.equal(v.snapshot(verdict({extra:1})),null);assert.equal(v.snapshot(verdict({draftHash:'x'})),null);
});

test('recommendation must be consistent with the highest severity',()=>{
  assert.ok(v.snapshot(verdict({warnings:[],recommendation:'ALLOW'})));
  assert.equal(v.snapshot(verdict({warnings:[],recommendation:'BLOCK'})),null);
  assert.equal(v.snapshot(verdict({recommendation:'ALLOW'})),null);
  const blocking=[warn({severity:'BLOCKING',warningClass:'UNSAFE_ACTION_REQUEST'})];
  assert.ok(v.snapshot(verdict({warnings:blocking,recommendation:'BLOCK'})));
  assert.ok(v.snapshot(verdict({warnings:blocking,recommendation:'ESCALATE'})));
  assert.equal(v.snapshot(verdict({warnings:blocking,recommendation:'LABEL'})),null);
});

test('warning classes cover the hallucination early-warning duty and checker kinds are attributable',()=>{
  assert.equal(v.WARNING_CLASSES.length,12);
  for(const c of ['CONTEXT_MISMATCH','SOURCE_EVIDENCE_MISMATCH','UNSUPPORTED_FACTUAL_ASSERTION','STALE_AUTHORITATIVE_STATE','CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','FALSE_CERTAINTY','PROVENANCE_GAP','INSTRUCTION_CONFLICT','ROLE_CONFUSION','UNINTENDED_TASK_EXPANSION','UNSAFE_ACTION_REQUEST','CORRELATED_FAILURE_RISK'])assert.ok(v.WARNING_CLASSES.includes(c),c);
  const mixed=verdict({warnings:[warn(),warn({checkerKind:'MODEL',warningClass:'FALSE_CERTAINTY'})]});
  assert.deepEqual([...v.checkerKinds(mixed)],['DETERMINISTIC','MODEL']);
  assert.equal(v.highestSeverity(v.snapshot(mixed).warnings),'WARN');
  assert.deepEqual([...v.checkerKinds({})],[]);
});

test('exports no approve, apply, rewrite or execute capability',()=>{
  assert.deepEqual(Object.keys(v),['VERSION','WARNING_CLASSES','SEVERITIES','RECOMMENDATIONS','CHECKER_KINDS','warning','snapshot','highestSeverity','checkerKinds']);
  assert.equal(Object.isFrozen(v),true);
});

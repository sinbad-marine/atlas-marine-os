'use strict';
// Project 2 Phase 3.6 - Pilot v0 (inert, deterministic control-state recommender, record-only).
// Owner GO "PROJECT 2 / PHASE 3.6 - PILOT v0 ONLY" (2026-09-18).
//
// Pilot v0 is a pure, deterministic function: one task context, one draft reference and the sealed
// records other components already produced for that draft (a GatekeeperDecision, optionally a
// CoPilotReview) -> one sealed PilotDecision that recommends the next control state:
// PROCEED / REQUEST_EVIDENCE / REVISE_DRAFT / ESCALATE_OWNER / STOP. These are recommendations on
// paper, not execution instructions. Pilot v0 never runs the other components (it only checks the
// integrity of their records with their own verify functions), never writes or rewrites a draft,
// never executes, approves or grants anything, calls no model, performs no I/O, keeps no state,
// reads no clock, is not wired anywhere and fails closed (STOP) on any input it cannot trust.
const {own,id,hash,time,bool,oneOf,nullableHash,freezeDeep}=require('../authority/exact');
const taskContext=require('../authority/task-context');
const verdictContract=require('../authority/copilot-verdict');
const gateContract=require('../authority/gate-decision');
const {sha256,canonical}=require('../sentinel/sentinel-v0');
const gatekeeper=require('../gatekeeper/gatekeeper-v0');
const copilot=require('../copilot/copilot-v0');

const VERSION='sinbad-pilot/0-v1';
const INPUT_VERSION='sinbad-pilot-input/0-v1';
const DECISION_VERSION='sinbad-pilot-decision/0-v1';
const RULESET_VERSION='sinbad-pilot-ruleset/0-v1';
// Ordered by precedence: the first class present among the findings wins.
const DECISIONS=Object.freeze(['STOP','ESCALATE_OWNER','REVISE_DRAFT','REQUEST_EVIDENCE','PROCEED']);
const LABELLED_DELIVERY=Object.freeze(['PROCEED','IMPROVE']);
const INPUT_FIELDS=Object.freeze(['version','pilotDecisionId','decidedAt','context','draftRef','gateDecision','review','iterationIndex','policy','priorPilotDecisionDigest']);
const DRAFT_REF_FIELDS=Object.freeze(['draftId','draftHash']);
const POLICY_FIELDS=Object.freeze(['maxIterations','labelledDelivery']);
const MAX_ITERATIONS=16,MAX_RECORD_CHARS=2_000_000,MAX_POINTER=512;
const DEFAULT_POLICY=Object.freeze({maxIterations:3,labelledDelivery:'PROCEED'});
// What a failed gate rule asks for next. STOP: the pipeline itself is not trustworthy.
// ESCALATE_OWNER: only an authority outside the loop can resolve it. REVISE_DRAFT: the draft says
// something it must not say. REQUEST_EVIDENCE: the draft may be right but is not yet supported.
const RULE_CLASS=Object.freeze({
  'GATE.INPUT_ADMITTED':'STOP','GATE.OBSERVATION_AVAILABLE':'STOP','GATE.VERDICT_MATCHES_DRAFT':'STOP',
  'GATE.ACTIONS_AUTHORIZED':'ESCALATE_OWNER',
  'GATE.CITATIONS_IN_EVIDENCE':'REVISE_DRAFT','GATE.CLAIM_EVIDENCE_RESOLVABLE':'REVISE_DRAFT','GATE.SPECIFICITY_SUPPORTED':'REVISE_DRAFT','GATE.VOCABULARY_BOUND':'REVISE_DRAFT','GATE.FOREIGN_CLAIMS_EXCLUDED':'REVISE_DRAFT','GATE.CLAIM_TEXT_OBSERVABLE':'REVISE_DRAFT',
  'GATE.VOLATILE_CLAIMS_LIVE':'REQUEST_EVIDENCE','GATE.CLAIMS_SUPPORTED':'REQUEST_EVIDENCE','GATE.EVIDENCE_CONSISTENT':'REQUEST_EVIDENCE','GATE.EVIDENCE_FRESH':'REQUEST_EVIDENCE','GATE.EVIDENCE_IN_SCOPE':'REQUEST_EVIDENCE','GATE.PROVENANCE_ADEQUATE':'REQUEST_EVIDENCE'
});
const WARNING_CLASS=Object.freeze({
  INSTRUCTION_CONFLICT:'ESCALATE_OWNER',UNINTENDED_TASK_EXPANSION:'ESCALATE_OWNER',UNSAFE_ACTION_REQUEST:'ESCALATE_OWNER',CORRELATED_FAILURE_RISK:'ESCALATE_OWNER',
  CONTEXT_MISMATCH:'REVISE_DRAFT',SOURCE_EVIDENCE_MISMATCH:'REVISE_DRAFT',FALSE_CERTAINTY:'REVISE_DRAFT',ROLE_CONFUSION:'REVISE_DRAFT',
  UNSUPPORTED_FACTUAL_ASSERTION:'REQUEST_EVIDENCE',STALE_AUTHORITATIVE_STATE:'REQUEST_EVIDENCE',CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH:'REQUEST_EVIDENCE',PROVENANCE_GAP:'REQUEST_EVIDENCE'
});
const RULES=Object.freeze([
  Object.freeze({ruleId:'PILOT.INPUT_ADMITTED',decision:'STOP',what:'the input is exact; context, draft reference, policy and iteration index are valid; the context is not expired at decidedAt'}),
  Object.freeze({ruleId:'PILOT.RECORDS_INTACT',decision:'STOP',what:'every supplied record is plain data of the expected version and ruleset, passes its own verify function and has the expected shape'}),
  Object.freeze({ruleId:'PILOT.RECORDS_COHERENT',decision:'STOP',what:'the records belong to this task and this draft, are not from the future, name the same verdict and do not contradict each other'}),
  Object.freeze({ruleId:'PILOT.PIPELINE_TRUSTED',decision:'STOP',what:'no component failed closed and no pipeline-integrity gate rule failed; a protected action comes with a verdict'}),
  Object.freeze({ruleId:'PILOT.AUTHORITY_IN_LOOP',decision:'ESCALATE_OWNER',what:'nothing in the records needs an authority outside the loop: the gate did not escalate, no authority-class rule or warning fired'}),
  Object.freeze({ruleId:'PILOT.ITERATION_BUDGET',decision:'ESCALATE_OWNER',what:'a blocked draft may only be sent back while the iteration budget lasts; afterwards the Owner decides'}),
  Object.freeze({ruleId:'PILOT.DRAFT_ACCEPTABLE',decision:'REVISE_DRAFT',what:'no draft-class rule or warning fired (fabricated citation, unbound specifics or vocabulary, foreign claim, authority voice, ...)'}),
  Object.freeze({ruleId:'PILOT.EVIDENCE_SUFFICIENT',decision:'REQUEST_EVIDENCE',what:'no evidence-class rule or warning fired (unsupported, stale, conflicting, foreign or missing evidence, volatile claim without live evidence)'}),
  Object.freeze({ruleId:'PILOT.GATE_ADMITS',decision:'PROCEED',what:'the gate admitted the draft, or admitted it with labels and nothing blocking remains'})
]);
const pointer=text=>typeof text==='string'&&text.length?(text.length<=MAX_POINTER?text:text.slice(0,MAX_POINTER)):null;

function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!Number.isSafeInteger(v.maxIterations)||v.maxIterations<1||v.maxIterations>MAX_ITERATIONS||!oneOf(LABELLED_DELIVERY,v.labelledDelivery))return null;
  return freezeDeep({maxIterations:v.maxIterations,labelledDelivery:v.labelledDelivery});
}
function draftRef(input){
  const v=own(DRAFT_REF_FIELDS,input);
  if(!v||!id(v.draftId)||!hash(v.draftHash))return null;
  return freezeDeep({draftId:v.draftId,draftHash:v.draftHash});
}
// Records are admitted as plain JSON data only: the copy is what gets verified and read, so an
// accessor or proxy cannot show one value to the verifier and another to the rules.
function plainCopy(record){
  if(record===null||typeof record!=='object'||Array.isArray(record))return null;
  try{const text=JSON.stringify(record);if(typeof text!=='string'||text.length>MAX_RECORD_CHARS)return null;return JSON.parse(text);}catch{return null;}
}
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function gateRecord(record){
  const r=plainCopy(record);
  if(!r||r.version!==gatekeeper.DECISION_VERSION||!gatekeeper.verifyDecision(r))return null;
  if(!oneOf(gateContract.OUTCOMES,r.outcome)||!bool(r.failClosed)||typeof r.reasonCode!=='string'||!time(r.observedAt)||r.authority!=='NONE'||r.executes!==false||r.stage!=='POST')return null;
  if(!Array.isArray(r.labels)||!r.labels.every(l=>typeof l==='string')||!Array.isArray(r.ruleResults)||!isObject(r.provenance)||!isObject(r.decision)||!isObject(r.decision.attribution))return null;
  if(r.provenance.gatekeeperVersion!==gatekeeper.VERSION||r.provenance.rulesetVersion!==gatekeeper.RULESET_VERSION||!(r.provenance.verdictId===null||id(r.provenance.verdictId))||!(r.decision.attribution.modelVerdictId===null||id(r.decision.attribution.modelVerdictId)))return null;
  if(r.decision.outcome!==r.outcome||!r.ruleResults.every(x=>isObject(x)&&gateContract.rule({ruleId:x.ruleId,outcome:x.outcome,blocking:x.blocking,detailRef:x.detailRef})!==null&&Object.hasOwn(RULE_CLASS,x.ruleId)))return null;
  return r;
}
function reviewRecord(record){
  const r=plainCopy(record);
  if(!r||r.version!==copilot.REVIEW_VERSION||!copilot.verifyReview(r))return null;
  if(!oneOf(copilot.STATUSES,r.status)||!bool(r.failClosed)||!time(r.issuedAt)||r.authority!=='NONE'||r.rewrites!==false||r.approves!==false||r.callsModel!==false||!isObject(r.provenance))return null;
  if(r.provenance.copilotVersion!==copilot.VERSION||r.provenance.checkersetVersion!==copilot.CHECKERSET_VERSION)return null;
  if(r.verdict!==null&&!verdictContract.snapshot(r.verdict))return null;
  return r;
}
function seal(record){return freezeDeep({...record,pilotDecisionDigest:sha256(canonical(record))});}
function conclude(meta,decision,ruleId,reasonCode,findings,carryLabels){
  const failClosed=decision==='STOP';
  return seal({
    version:DECISION_VERSION,pilotDecisionId:meta.pilotDecisionId,taskRef:meta.taskRef,decision,failClosed,reasonCode,ruleId,
    findings,carryLabels:decision==='PROCEED'?carryLabels:[],
    gate:meta.gate,review:meta.review,iteration:meta.iteration,
    provenance:{pilotVersion:VERSION,rulesetVersion:RULESET_VERSION,inputDigest:meta.inputDigest,contextTaskId:meta.taskRef,draftId:meta.draftId,draftHash:meta.draftHash,gateDecisionDigest:meta.gate?meta.gate.decisionDigest:null,reviewDigest:meta.review?meta.review.reviewDigest:null,verdictId:meta.verdictId,priorPilotDecisionDigest:meta.priorPilotDecisionDigest,policy:meta.policy},
    decidedAt:meta.decidedAt,authority:'NONE',recommendationOnly:true,executes:false,approves:false,grantsAuthority:false,rewrites:false,callsModel:false
  });
}

// decide(input) -> PilotDecision. Never throws; untrustworthy input yields STOP with the reason.
function decide(input){
  const meta={pilotDecisionId:'invalid',taskRef:null,decidedAt:0,draftId:null,draftHash:null,verdictId:null,priorPilotDecisionDigest:null,policy:null,inputDigest:null,gate:null,review:null,iteration:null};
  try{return evaluate(input,meta);}catch{return conclude(meta,'STOP','PILOT.INPUT_ADMITTED','INTERNAL_INVARIANT_VIOLATED',[],[]);}
}
function evaluate(input,meta){
  const stop=(ruleId,reasonCode,findings)=>conclude(meta,'STOP',ruleId,reasonCode,findings||[],[]);
  const v=own(INPUT_FIELDS,input);
  if(!v||v.version!==INPUT_VERSION||!id(v.pilotDecisionId)||!time(v.decidedAt)||!nullableHash(v.priorPilotDecisionDigest))return stop('PILOT.INPUT_ADMITTED','INPUT_INVALID');
  Object.assign(meta,{pilotDecisionId:v.pilotDecisionId,decidedAt:v.decidedAt,priorPilotDecisionDigest:v.priorPilotDecisionDigest});
  const pol=policy(v.policy);if(!pol)return stop('PILOT.INPUT_ADMITTED','POLICY_INVALID');meta.policy=pol;
  if(!Number.isSafeInteger(v.iterationIndex)||v.iterationIndex<0||v.iterationIndex>=pol.maxIterations)return stop('PILOT.INPUT_ADMITTED','ITERATION_INVALID');
  const remaining=pol.maxIterations-v.iterationIndex-1;meta.iteration={index:v.iterationIndex,maxIterations:pol.maxIterations,remaining};
  const ctx=taskContext.snapshot(v.context);if(!ctx)return stop('PILOT.INPUT_ADMITTED','CONTEXT_INVALID');meta.taskRef=ctx.taskId;
  const ref=draftRef(v.draftRef);if(!ref)return stop('PILOT.INPUT_ADMITTED','DRAFT_REF_INVALID');Object.assign(meta,{draftId:ref.draftId,draftHash:ref.draftHash});
  if(taskContext.isExpired(ctx,v.decidedAt))return stop('PILOT.INPUT_ADMITTED','CONTEXT_EXPIRED');

  // Records: integrity first, then coherence with this task, this draft and each other.
  if(v.gateDecision===null)return stop('PILOT.RECORDS_INTACT','GATE_DECISION_REQUIRED');
  const gate=gateRecord(v.gateDecision);if(!gate)return stop('PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  const review=v.review===null?null:reviewRecord(v.review);if(v.review!==null&&!review)return stop('PILOT.RECORDS_INTACT','REVIEW_INVALID');
  meta.gate={decisionId:gate.decisionId,decisionDigest:gate.decisionDigest,outcome:gate.outcome,reasonCode:gate.reasonCode,failClosed:gate.failClosed,deliveryLabel:gate.deliveryLabel,observationSignal:gate.observation?gate.observation.signal:null,observationCoverage:gate.observation?gate.observation.coverage:null};
  if(review)meta.review={reviewId:review.reviewId,reviewDigest:review.reviewDigest,status:review.status,reasonCode:review.reasonCode,recommendation:review.verdict?review.verdict.recommendation:null};
  meta.verdictId=gate.provenance.verdictId;
  meta.inputDigest=sha256(canonical({version:INPUT_VERSION,pilotDecisionId:v.pilotDecisionId,decidedAt:v.decidedAt,context:ctx,draftRef:ref,gateDecisionDigest:gate.decisionDigest,reviewDigest:review?review.reviewDigest:null,iterationIndex:v.iterationIndex,policy:pol,priorPilotDecisionDigest:v.priorPilotDecisionDigest}));
  if(gate.observedAt>v.decidedAt||(review&&review.issuedAt>v.decidedAt))return stop('PILOT.RECORDS_COHERENT','RECORD_FROM_THE_FUTURE');
  if(gate.failClosed&&gate.provenance.draftHash===null)return stop('PILOT.PIPELINE_TRUSTED','GATE_FAILED_CLOSED');
  if(gate.taskRef!==ctx.taskId||(review&&review.taskRef!==null&&review.taskRef!==ctx.taskId))return stop('PILOT.RECORDS_COHERENT','TASK_MISMATCH');
  if(gate.provenance.draftHash!==ref.draftHash||gate.provenance.draftId!==ref.draftId||(review&&review.provenance.draftHash!==null&&(review.provenance.draftHash!==ref.draftHash||review.provenance.draftId!==ref.draftId)))return stop('PILOT.RECORDS_COHERENT','DRAFT_MISMATCH');
  if(review&&review.status!=='REVIEWED')return stop('PILOT.PIPELINE_TRUSTED','REVIEW_FAILED_CLOSED');
  if(review&&gate.provenance.verdictId!==review.verdict.verdictId)return stop('PILOT.RECORDS_COHERENT','VERDICT_MISMATCH');

  // Findings: every failed gate rule, and every WARN or BLOCKING warning of the verdict the gate consumed.
  const findings=[];
  for(const r of gate.ruleResults)if(r.outcome==='FAIL')findings.push({source:'GATE_RULE',ref:r.ruleId,asks:RULE_CLASS[r.ruleId],blocking:r.blocking,detailRef:pointer(r.detailRef)});
  if(review)for(const w of review.verdict.warnings)if(w.severity!=='INFO')findings.push({source:'VERDICT_WARNING',ref:w.warningClass,asks:WARNING_CLASS[w.warningClass],blocking:w.severity==='BLOCKING',detailRef:pointer(w.pointerRef)});
  const asks=cls=>findings.some(f=>f.asks===cls);const blocking=findings.some(f=>f.blocking);

  if(gate.reasonCode==='VERDICT_MISSING_FOR_PROTECTED_ACTION')return stop('PILOT.PIPELINE_TRUSTED','VERDICT_REQUIRED_FOR_PROTECTED_ACTION',findings);
  if(asks('STOP')||(gate.failClosed&&!findings.length))return stop('PILOT.PIPELINE_TRUSTED','GATE_FAILED_CLOSED',findings);
  // A gate record whose outcome does not follow from its own rule results is not a gate decision.
  if(findings.some(f=>f.source==='GATE_RULE'&&f.blocking)&&gate.outcome!=='BLOCK')return stop('PILOT.RECORDS_COHERENT','RECORDS_INCOHERENT',findings);
  if(gate.outcome==='ADMIT'){
    if(findings.length)return stop('PILOT.RECORDS_COHERENT','RECORDS_INCOHERENT',findings);
    return conclude(meta,'PROCEED','PILOT.GATE_ADMITS','ALL_CLEAR',findings,[...gate.labels]);
  }
  if(!findings.length)return stop('PILOT.RECORDS_COHERENT',gate.decision.attribution.modelVerdictId!==null&&!review?'VERDICT_DETAIL_MISSING':'RECORDS_INCOHERENT',findings);
  if(gate.outcome==='LABEL'&&blocking&&!review)return stop('PILOT.RECORDS_COHERENT','RECORDS_INCOHERENT',findings);
  if(gate.outcome==='ESCALATE')return conclude(meta,'ESCALATE_OWNER','PILOT.AUTHORITY_IN_LOOP','GATE_ESCALATED',findings,[]);
  if(asks('ESCALATE_OWNER'))return conclude(meta,'ESCALATE_OWNER','PILOT.AUTHORITY_IN_LOOP','AUTHORITY_REQUIRED',findings,[]);
  const next=asks('REVISE_DRAFT')?['REVISE_DRAFT','PILOT.DRAFT_ACCEPTABLE','DRAFT_FINDINGS']:['REQUEST_EVIDENCE','PILOT.EVIDENCE_SUFFICIENT','EVIDENCE_FINDINGS'];
  if(gate.outcome==='BLOCK'||blocking){
    if(remaining<1)return conclude(meta,'ESCALATE_OWNER','PILOT.ITERATION_BUDGET','ITERATION_BUDGET_EXHAUSTED',findings,[]);
    return conclude(meta,next[0],next[1],next[2],findings,[]);
  }
  // Labelled delivery: the gate admits the draft with labels and nothing blocking remains.
  if(pol.labelledDelivery==='IMPROVE'&&remaining>=1)return conclude(meta,next[0],next[1],`${next[2]}_BEFORE_LABELLED_DELIVERY`,findings,[]);
  return conclude(meta,'PROCEED','PILOT.GATE_ADMITS',pol.labelledDelivery==='IMPROVE'?'LABELLED_DELIVERY_AFTER_BUDGET':'LABELLED_DELIVERY_ADMITTED',findings,[...gate.labels]);
}
// verifyPilotDecision(record): recomputes the digest; true only if the record is intact. A digest
// proves integrity, not origin: anyone can seal a record, so authenticity is the caller's concern.
function verifyPilotDecision(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!hash(record.pilotDecisionDigest))return false;
  try{const {pilotDecisionDigest,...rest}=record;return sha256(canonical(rest))===pilotDecisionDigest&&oneOf(DECISIONS,rest.decision)&&rest.authority==='NONE'&&rest.executes===false;}catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,DECISION_VERSION,RULESET_VERSION,DECISIONS,LABELLED_DELIVERY,INPUT_FIELDS,DRAFT_REF_FIELDS,POLICY_FIELDS,MAX_ITERATIONS,DEFAULT_POLICY,RULE_CLASS,WARNING_CLASS,RULES,policy,draftRef,decide,verifyPilotDecision});

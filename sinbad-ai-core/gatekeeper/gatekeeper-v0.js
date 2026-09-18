'use strict';
// Project 2 Phase 3.4 - Gatekeeper v0 (inert, deterministic post-gate, label-only).
// Owner GO "PROJECT 2 / PHASE 3.4 - GATEKEEPER v0 ONLY" (2026-09-17).
//
// Gatekeeper v0 is a pure, deterministic function: one draft (claims, citations, proposed actions)
// with its task context, evidence set, policy and an optional Co-Pilot verdict -> one sealed
// GatekeeperDecision. It runs Sentinel v0 as its observation engine, applies fixed gate rules
// (citation-vs-evidence, specificity, claim vocabulary, volatile claims, context integrity,
// action authority, provenance adequacy) and composes the outcome through the accepted
// GateDecision contract, so every outcome is attributable to a rule id or a verdict id.
// It attaches labels and decides ADMIT / LABEL / ESCALATE / BLOCK on paper only: it executes
// nothing, delivers nothing, grants nothing, is not wired anywhere, and fails closed on any input
// it cannot trust. Rules are code; the Co-Pilot verdict is an input signal, never a rule.
const {own,id,hash,time,bool,oneOf,idList,nullableHash,freezeDeep}=require('../authority/exact');
const taskContext=require('../authority/task-context');
const evidenceSet=require('../authority/evidence-set');
const copilot=require('../authority/copilot-verdict');
const gateDecision=require('../authority/gate-decision');
const sentinel=require('../sentinel/sentinel-v0');

const VERSION='sinbad-gatekeeper/0-v1';
const INPUT_VERSION='sinbad-gatekeeper-input/0-v1';
const DECISION_VERSION='sinbad-gatekeeper-decision/0-v1';
const RULESET_VERSION='sinbad-gatekeeper-ruleset/0-v1';
const STAGE='POST';
const ACTION_CLASSES=Object.freeze(['READ','WRITE','EXECUTE','DELIVER']);
const ALWAYS_PROTECTED=Object.freeze(['WRITE','EXECUTE']);
const LABEL_ORDER=Object.freeze(['VERIFIED','NOT_APPLICABLE','NOT_VERIFIED','SOURCE_MISSING','CONFLICT','BLOCKED']);
const LIVE_CLASSES=Object.freeze(['LIVE_SYSTEM','DATABASE']);
const INPUT_FIELDS=Object.freeze(['version','decisionId','observedAt','context','evidenceSet','draft','verdict','policy','priorDecisionDigest']);
const DRAFT_FIELDS=Object.freeze(['draftId','draftHash','claims','citations','proposedActions']);
const CITATION_FIELDS=Object.freeze(['citationId','evidenceId']);
const ACTION_FIELDS=Object.freeze(['actionId','actionClass','protected','authorityRef']);
const POLICY_FIELDS=Object.freeze(['maxEvidenceAgeMs','volatileMaxEvidenceAgeMs']);
const MAX_CITATIONS=256,MAX_ACTIONS=64,MAX_POINTER=512;
const DEFAULT_POLICY=Object.freeze({maxEvidenceAgeMs:24*60*60*1000,volatileMaxEvidenceAgeMs:5*60*1000});
// Claims about the present state of a system (volatile facts) need fresh live-system or database
// evidence; a repository or document read cannot establish what is the case "now".
const VOLATILE=/(?<![\p{L}\p{N}])(?:now|right now|currently|current|today|at the moment|as of now|latest|is running|is up|is down|still running|şu an|şu anda|bugün|güncel|halen|çalışıyor|ayakta)(?![\p{L}\p{N}])/iu;
const RULES=Object.freeze([
  Object.freeze({ruleId:'GATE.INPUT_ADMITTED',blocking:true,source:'GATE',what:'input is exact and internally consistent (context, evidence set, draft, verdict, policy)'}),
  Object.freeze({ruleId:'GATE.OBSERVATION_AVAILABLE',blocking:true,source:'GATE',what:'the Sentinel observation of the draft completed (not BLOCKED)'}),
  Object.freeze({ruleId:'GATE.CITATIONS_IN_EVIDENCE',blocking:true,source:'GATE',what:'every citation of the draft refers to an evidence id in the task evidence set'}),
  Object.freeze({ruleId:'GATE.CLAIM_EVIDENCE_RESOLVABLE',blocking:true,source:'SENTINEL.PROVENANCE_RESOLVABLE',what:'every claim evidence id exists in the evidence set'}),
  Object.freeze({ruleId:'GATE.SPECIFICITY_SUPPORTED',blocking:true,source:'SENTINEL.NO_UNSUPPORTED_SPECIFICS',what:'specific values (digests, ids, dates, versions) are asserted only in VERIFIED claims'}),
  Object.freeze({ruleId:'GATE.VOCABULARY_BOUND',blocking:true,source:'SENTINEL.RESERVED_TERMS_BOUND',what:'reserved terms (VERIFIED, PASS, MERGED, ONLINE, OWNER ACCEPTED, ...) appear only in VERIFIED claims'}),
  Object.freeze({ruleId:'GATE.FOREIGN_CLAIMS_EXCLUDED',blocking:true,source:'SENTINEL.NO_FOREIGN_ADOPTION',what:'no claim from a foreign scope is asserted without in-scope verification'}),
  Object.freeze({ruleId:'GATE.VOLATILE_CLAIMS_LIVE',blocking:true,source:'GATE',what:'claims about the present state rest on fresh live-system or database evidence'}),
  Object.freeze({ruleId:'GATE.ACTIONS_AUTHORIZED',blocking:true,source:'GATE',what:'every protected proposed action carries an authority reference present in the task context'}),
  Object.freeze({ruleId:'GATE.VERDICT_MATCHES_DRAFT',blocking:true,source:'GATE',what:'a supplied Co-Pilot verdict refers to this task and this draft hash'}),
  Object.freeze({ruleId:'GATE.CLAIMS_SUPPORTED',blocking:false,source:'SENTINEL.CLAIMS_SUPPORTED',what:'every asserted claim is VERIFIED'}),
  Object.freeze({ruleId:'GATE.EVIDENCE_CONSISTENT',blocking:false,source:'SENTINEL.EVIDENCE_CONSISTENT',what:'no locator observed with two contents'}),
  Object.freeze({ruleId:'GATE.EVIDENCE_FRESH',blocking:false,source:'SENTINEL.EVIDENCE_FRESH',what:'no evidence item older than policy.maxEvidenceAgeMs'}),
  Object.freeze({ruleId:'GATE.EVIDENCE_IN_SCOPE',blocking:false,source:'SENTINEL.EVIDENCE_IN_SCOPE',what:'no evidence item from a foreign scope'}),
  Object.freeze({ruleId:'GATE.PROVENANCE_ADEQUATE',blocking:false,source:'GATE',what:'claims come with an evidence set and every claim names at least one evidence id'}),
  Object.freeze({ruleId:'GATE.CLAIM_TEXT_OBSERVABLE',blocking:false,source:'GATE',what:'every asserted claim carries text so vocabulary, specificity and volatility can be screened'})
]);
const pointer=text=>text.length<=MAX_POINTER?text:text.slice(0,MAX_POINTER);
const {sha256,canonical}=sentinel;

function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!Number.isSafeInteger(v.maxEvidenceAgeMs)||v.maxEvidenceAgeMs<1||!Number.isSafeInteger(v.volatileMaxEvidenceAgeMs)||v.volatileMaxEvidenceAgeMs<1||v.volatileMaxEvidenceAgeMs>v.maxEvidenceAgeMs)return null;
  if(!sentinel.policy({maxEvidenceAgeMs:v.maxEvidenceAgeMs}))return null;
  return freezeDeep({maxEvidenceAgeMs:v.maxEvidenceAgeMs,volatileMaxEvidenceAgeMs:v.volatileMaxEvidenceAgeMs});
}
function citation(input){
  const v=own(CITATION_FIELDS,input);
  if(!v||!id(v.citationId)||!id(v.evidenceId))return null;
  return freezeDeep({citationId:v.citationId,evidenceId:v.evidenceId});
}
function action(input){
  const v=own(ACTION_FIELDS,input);
  if(!v||!id(v.actionId)||!oneOf(ACTION_CLASSES,v.actionClass)||!bool(v.protected)||!(v.authorityRef===null||id(v.authorityRef)))return null;
  if(ALWAYS_PROTECTED.includes(v.actionClass)&&!v.protected)return null;
  return freezeDeep({actionId:v.actionId,actionClass:v.actionClass,protected:v.protected,authorityRef:v.authorityRef});
}
function draft(input){
  const v=own(DRAFT_FIELDS,input);
  if(!v||!id(v.draftId)||!hash(v.draftHash)||!Array.isArray(v.claims)||v.claims.length>sentinel.MAX_CLAIMS||!Array.isArray(v.citations)||v.citations.length>MAX_CITATIONS||!Array.isArray(v.proposedActions)||v.proposedActions.length>MAX_ACTIONS)return null;
  const claims=v.claims.map(sentinel.claim),citations=v.citations.map(citation),actions=v.proposedActions.map(action);
  if(claims.some(x=>!x)||citations.some(x=>!x)||actions.some(x=>!x))return null;
  if(new Set(claims.map(x=>x.claimId)).size!==claims.length||new Set(citations.map(x=>x.citationId)).size!==citations.length||new Set(actions.map(x=>x.actionId)).size!==actions.length)return null;
  return freezeDeep({draftId:v.draftId,draftHash:v.draftHash,claims,citations,proposedActions:actions});
}
function ruleResult(ruleId,failed,detail){
  const rule=RULES.find(r=>r.ruleId===ruleId);
  return {ruleId,outcome:failed?'FAIL':'PASS',blocking:rule.blocking,detailRef:failed&&detail?pointer(detail):null};
}
function worst(labels){let rank=-1;for(const l of labels){const r=LABEL_ORDER.indexOf(l);if(r>rank)rank=r;}return rank<0?'NOT_APPLICABLE':LABEL_ORDER[rank];}
function seal(record){return freezeDeep({...record,decisionDigest:sha256(canonical(record))});}
function blocked(meta,reasonCode){
  const rules=[ruleResult('GATE.INPUT_ADMITTED',true,`reason:${reasonCode}`)];
  const decision=gateDecision.decide({decisionId:meta.decisionId,taskRef:meta.taskRef,stage:STAGE,rules:rules.map(r=>({...r})),verdict:null,protectedAction:true,decidedAt:meta.observedAt});
  return seal({
    version:DECISION_VERSION,decisionId:meta.decisionId,taskRef:meta.taskRef,stage:STAGE,outcome:'BLOCK',failClosed:true,reasonCode,labels:['BLOCKED'],deliveryLabel:'BLOCKED',
    decision,claimLabels:[],actions:meta.actions.map(a=>({actionId:a.actionId,actionClass:a.actionClass,protected:a.protected,authorityRef:a.authorityRef,status:'BLOCKED',reasonCode})),
    ruleResults:rules,observation:meta.observation,
    provenance:{gatekeeperVersion:VERSION,rulesetVersion:RULESET_VERSION,sentinelVersion:sentinel.VERSION,inputDigest:meta.inputDigest,contextTaskId:meta.taskRef,evidenceSetId:meta.evidenceSetId,draftId:meta.draftId,draftHash:meta.draftHash,observationDigest:meta.observation?meta.observation.reportDigest:null,verdictId:meta.verdictId,priorDecisionDigest:meta.priorDecisionDigest,policy:meta.policy},
    observedAt:meta.observedAt,authority:'NONE',executes:false
  });
}

// decide(input) -> GatekeeperDecision. Never throws; untrustworthy input yields a BLOCK that names why.
function decide(input){
  const meta={decisionId:'invalid',taskRef:'invalid',observedAt:0,evidenceSetId:null,draftId:null,draftHash:null,verdictId:null,priorDecisionDigest:null,policy:null,inputDigest:null,observation:null,actions:[]};
  try{return evaluate(input,meta);}catch{return blocked(meta,'INTERNAL_INVARIANT_VIOLATED');}
}
function evaluate(input,meta){
  const v=own(INPUT_FIELDS,input);
  if(!v||v.version!==INPUT_VERSION||!id(v.decisionId)||!time(v.observedAt)||!nullableHash(v.priorDecisionDigest))return blocked(meta,'INPUT_INVALID');
  Object.assign(meta,{decisionId:v.decisionId,observedAt:v.observedAt,priorDecisionDigest:v.priorDecisionDigest});
  const pol=policy(v.policy);if(!pol)return blocked(meta,'POLICY_INVALID');meta.policy=pol;
  const ctx=taskContext.snapshot(v.context);if(!ctx)return blocked(meta,'CONTEXT_INVALID');meta.taskRef=ctx.taskId;
  const set=v.evidenceSet===null?null:evidenceSet.snapshot(v.evidenceSet);
  if(v.evidenceSet!==null&&!set)return blocked(meta,'EVIDENCE_SET_INVALID');
  if(set)meta.evidenceSetId=set.setId;
  const d=draft(v.draft);if(!d)return blocked(meta,'DRAFT_INVALID');
  Object.assign(meta,{draftId:d.draftId,draftHash:d.draftHash,actions:d.proposedActions});
  const verdict=v.verdict===null?null:copilot.snapshot(v.verdict);
  if(v.verdict!==null&&!verdict)return blocked(meta,'VERDICT_INVALID');
  if(verdict)meta.verdictId=verdict.verdictId;
  const admitted={version:INPUT_VERSION,decisionId:v.decisionId,observedAt:v.observedAt,context:ctx,evidenceSet:set,draft:d,verdict,policy:pol,priorDecisionDigest:v.priorDecisionDigest};
  meta.inputDigest=sha256(canonical(admitted));
  if(taskContext.isExpired(ctx,v.observedAt))return blocked(meta,'CONTEXT_EXPIRED');
  if(set&&set.taskRef!==ctx.taskId)return blocked(meta,'EVIDENCE_TASK_MISMATCH');

  // Observation engine: Sentinel v0 over the same context, evidence and claims.
  const observation=sentinel.observe({version:sentinel.INPUT_VERSION,observationId:v.decisionId,tap:'POST_GATE',observedAt:v.observedAt,context:ctx,evidenceSet:set,claims:d.claims.map(c=>({...c,evidenceIds:[...c.evidenceIds]})),policy:{maxEvidenceAgeMs:pol.maxEvidenceAgeMs},priorReportDigest:null});
  meta.observation=observation;
  if(observation.status!=='OBSERVED')return blocked(meta,`OBSERVATION_${observation.reasonCode}`);
  const sentinelRule=ruleId=>observation.ruleResults.find(r=>r.ruleId===ruleId);
  const items=set?set.items:[];const byId=new Map(items.map(i=>[i.evidenceId,i]));

  // Gate-owned rules.
  const missingCitations=d.citations.filter(c=>!byId.has(c.evidenceId)).map(c=>c.citationId);
  const volatileFailures=[];const textless=[];const unbound=[];
  for(const claim of d.claims){
    const record=observation.claims.find(r=>r.claimId===claim.claimId);
    if(claim.assertionMode!=='ASSERTED')continue;
    if(claim.text===null){textless.push(claim.claimId);}
    else if(VOLATILE.test(claim.text)){
      const live=record.eligibleEvidenceIds.map(x=>byId.get(x)).filter(i=>LIVE_CLASSES.includes(i.sourceClass)&&i.observedAt>=v.observedAt-pol.volatileMaxEvidenceAgeMs);
      if(record.truthState!=='VERIFIED'||!live.length)volatileFailures.push(claim.claimId);
    }
    if(!claim.evidenceIds.length)unbound.push(claim.claimId);
  }
  const unauthorized=d.proposedActions.filter(a=>a.protected&&!(a.authorityRef!==null&&ctx.authorityRefs.includes(a.authorityRef))).map(a=>a.actionId);
  const verdictMismatch=Boolean(verdict)&&(verdict.taskRef!==ctx.taskId||verdict.draftHash!==d.draftHash);
  const fromSentinel=(gateRuleId,sentinelRuleId)=>{const r=sentinelRule(sentinelRuleId);return ruleResult(gateRuleId,r.outcome==='FAIL',r.detailRef);};
  const rules=[
    ruleResult('GATE.INPUT_ADMITTED',false,null),
    ruleResult('GATE.OBSERVATION_AVAILABLE',false,null),
    ruleResult('GATE.CITATIONS_IN_EVIDENCE',missingCitations.length>0,`citations:${missingCitations.join(',')}`),
    fromSentinel('GATE.CLAIM_EVIDENCE_RESOLVABLE','SENTINEL.PROVENANCE_RESOLVABLE'),
    fromSentinel('GATE.SPECIFICITY_SUPPORTED','SENTINEL.NO_UNSUPPORTED_SPECIFICS'),
    fromSentinel('GATE.VOCABULARY_BOUND','SENTINEL.RESERVED_TERMS_BOUND'),
    fromSentinel('GATE.FOREIGN_CLAIMS_EXCLUDED','SENTINEL.NO_FOREIGN_ADOPTION'),
    ruleResult('GATE.VOLATILE_CLAIMS_LIVE',volatileFailures.length>0,`claims:${volatileFailures.join(',')}`),
    ruleResult('GATE.ACTIONS_AUTHORIZED',unauthorized.length>0,`actions:${unauthorized.join(',')}`),
    ruleResult('GATE.VERDICT_MATCHES_DRAFT',verdictMismatch,verdict?`verdict:${verdict.verdictId}`:null),
    fromSentinel('GATE.CLAIMS_SUPPORTED','SENTINEL.CLAIMS_SUPPORTED'),
    fromSentinel('GATE.EVIDENCE_CONSISTENT','SENTINEL.EVIDENCE_CONSISTENT'),
    fromSentinel('GATE.EVIDENCE_FRESH','SENTINEL.EVIDENCE_FRESH'),
    fromSentinel('GATE.EVIDENCE_IN_SCOPE','SENTINEL.EVIDENCE_IN_SCOPE'),
    ruleResult('GATE.PROVENANCE_ADEQUATE',(set===null&&d.claims.length>0)||unbound.length>0,set===null&&d.claims.length?'evidence-set:not-provided':`claims:${unbound.join(',')}`),
    ruleResult('GATE.CLAIM_TEXT_OBSERVABLE',textless.length>0,`claims:${textless.join(',')}`)
  ];
  const protectedAction=d.proposedActions.some(a=>a.protected);
  // A mismatching verdict is not passed to the composition: it belongs to another draft.
  const decision=gateDecision.decide({decisionId:v.decisionId,taskRef:ctx.taskId,stage:STAGE,rules:rules.map(r=>({...r})),verdict:verdict&&!verdictMismatch?v.verdict:null,protectedAction,decidedAt:v.observedAt});
  const claimLabels=observation.claims.map(r=>({claimId:r.claimId,assertionMode:r.assertionMode,label:r.truthState,reasonCode:r.reasonCode,evidenceIds:[...r.eligibleEvidenceIds],volatile:volatileFailures.includes(r.claimId)}));
  const assertedLabels=claimLabels.filter(c=>c.assertionMode==='ASSERTED').map(c=>c.label);
  const deliveryLabel=decision.outcome==='BLOCK'?'BLOCKED':d.claims.length?worst(assertedLabels.length?assertedLabels:['NOT_APPLICABLE']):'NOT_APPLICABLE';
  const labels=[...new Set([...decision.labels,...(decision.outcome==='BLOCK'?[]:[deliveryLabel])])].filter(l=>l!=='NOT_APPLICABLE');
  const actions=d.proposedActions.map(a=>{
    if(decision.outcome==='BLOCK')return {actionId:a.actionId,actionClass:a.actionClass,protected:a.protected,authorityRef:a.authorityRef,status:'BLOCKED',reasonCode:decision.attribution.reasonCode};
    if(a.protected&&unauthorized.includes(a.actionId))return {actionId:a.actionId,actionClass:a.actionClass,protected:a.protected,authorityRef:a.authorityRef,status:'BLOCKED',reasonCode:'AUTHORITY_REFERENCE_MISSING'};
    if(decision.outcome==='ESCALATE'&&a.protected)return {actionId:a.actionId,actionClass:a.actionClass,protected:a.protected,authorityRef:a.authorityRef,status:'ESCALATED',reasonCode:decision.attribution.reasonCode};
    return {actionId:a.actionId,actionClass:a.actionClass,protected:a.protected,authorityRef:a.authorityRef,status:'ADMITTED',reasonCode:decision.attribution.reasonCode};
  });
  return seal({
    version:DECISION_VERSION,decisionId:v.decisionId,taskRef:ctx.taskId,stage:STAGE,outcome:decision.outcome,failClosed:decision.failClosed,reasonCode:decision.attribution.reasonCode,labels,deliveryLabel,
    decision,claimLabels,actions,ruleResults:rules,observation,
    provenance:{gatekeeperVersion:VERSION,rulesetVersion:RULESET_VERSION,sentinelVersion:sentinel.VERSION,inputDigest:meta.inputDigest,contextTaskId:ctx.taskId,evidenceSetId:set?set.setId:null,draftId:d.draftId,draftHash:d.draftHash,observationDigest:observation.reportDigest,verdictId:verdict?verdict.verdictId:null,priorDecisionDigest:v.priorDecisionDigest,policy:pol},
    observedAt:v.observedAt,authority:'NONE',executes:false
  });
}
function verifyDecision(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!hash(record.decisionDigest))return false;
  try{const {decisionDigest,...rest}=record;return sha256(canonical(rest))===decisionDigest&&(rest.observation===null||sentinel.verifyReport(rest.observation));}catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,DECISION_VERSION,RULESET_VERSION,STAGE,ACTION_CLASSES,ALWAYS_PROTECTED,LABEL_ORDER,LIVE_CLASSES,INPUT_FIELDS,DRAFT_FIELDS,CITATION_FIELDS,ACTION_FIELDS,POLICY_FIELDS,DEFAULT_POLICY,RULES,VOLATILE,policy,citation,action,draft,decide,verifyDecision});

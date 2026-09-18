'use strict';
// Project 2 Phase 3.5 - Co-Pilot v0 (inert, deterministic checker layer, verdict-only).
// Owner GO "PROJECT 2 / PHASE 3.5 - CO-PILOT v0 ONLY" (2026-09-18).
//
// Co-Pilot v0 is a pure, deterministic function: one draft (claims, citations, proposed actions)
// with its task context, evidence set and policy -> one sealed CoPilotReview that carries a
// CoPilotVerdict in the accepted Phase 3.1 contract shape. It is the deterministic checker layer
// only: it runs Sentinel v0 as its observation engine, forwards the Sentinel flags, adds its own
// checkers (citations, action safety, task expansion, authority voice) and derives a
// recommendation. Every warning has checkerKind DETERMINISTIC; there is no model pass in v0 and
// the warning classes that need one are reported as not covered instead of being guessed.
// It never writes an answer, rewrites a draft, approves an action or overrides a gate; it is not
// wired anywhere and fails closed on any input it cannot trust.
const {own,id,hash,time,bool,oneOf,nullableHash,freezeDeep}=require('../authority/exact');
const taskContext=require('../authority/task-context');
const evidenceSet=require('../authority/evidence-set');
const verdictContract=require('../authority/copilot-verdict');
const sentinel=require('../sentinel/sentinel-v0');

const VERSION='sinbad-copilot/0-v1';
const INPUT_VERSION='sinbad-copilot-input/0-v1';
const REVIEW_VERSION='sinbad-copilot-review/0-v1';
const CHECKERSET_VERSION='sinbad-copilot-checkerset/0-v1';
const STATUSES=Object.freeze(['REVIEWED','BLOCKED']);
const ACTION_CLASSES=Object.freeze(['READ','WRITE','EXECUTE','DELIVER']);
const ALWAYS_PROTECTED=Object.freeze(['WRITE','EXECUTE']);
const INPUT_FIELDS=Object.freeze(['version','reviewId','verdictId','issuedAt','context','evidenceSet','draft','policy','priorReviewDigest']);
const DRAFT_FIELDS=Object.freeze(['draftId','draftHash','claims','citations','proposedActions']);
const CITATION_FIELDS=Object.freeze(['citationId','evidenceId']);
const ACTION_FIELDS=Object.freeze(['actionId','actionClass','protected','authorityRef']);
const POLICY_FIELDS=Object.freeze(['maxEvidenceAgeMs']);
const MAX_CITATIONS=256,MAX_ACTIONS=64,MAX_POINTER=512,MAX_WARNINGS=128;
const DEFAULT_POLICY=Object.freeze({maxEvidenceAgeMs:24*60*60*1000});
// A draft that speaks with the voice of an authority (grants, approves, accepts, issues a GO) is
// confusing its role: authority is an input of the task context, never a product of the draft.
const AUTHORITY_VOICE=/(?<![\p{L}\p{N}])(?:i (?:hereby )?(?:approve|authorize|authorise|grant|accept)|as the owner|i am the owner|owner go|merge go|go is granted|approval granted|onaylıyorum|onay veriyorum|yetki veriyorum|kabul ediyorum|owner olarak)(?![\p{L}\p{N}])/iu;
const CHECKERS=Object.freeze([
  Object.freeze({checkerId:'COPILOT.SENTINEL_FLAGS',warningClasses:Object.freeze(['CONTEXT_MISMATCH','SOURCE_EVIDENCE_MISMATCH','UNSUPPORTED_FACTUAL_ASSERTION','STALE_AUTHORITATIVE_STATE','CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','FALSE_CERTAINTY','PROVENANCE_GAP']),what:'forwards every flag of the Sentinel observation of the draft'}),
  Object.freeze({checkerId:'COPILOT.CITATIONS_RESOLVE',warningClasses:Object.freeze(['SOURCE_EVIDENCE_MISMATCH']),what:'every citation refers to an evidence id in the task evidence set (BLOCKING otherwise)'}),
  Object.freeze({checkerId:'COPILOT.CITATIONS_USED',warningClasses:Object.freeze(['SOURCE_EVIDENCE_MISMATCH']),what:'every resolvable citation is used by at least one claim (WARN otherwise: decorative citation)'}),
  Object.freeze({checkerId:'COPILOT.CLAIMS_CITED',warningClasses:Object.freeze(['PROVENANCE_GAP']),what:'an asserted claim that rests on evidence comes with a citation of that evidence (INFO otherwise: supported but not traceable for the reader)'}),
  Object.freeze({checkerId:'COPILOT.ACTIONS_SAFE',warningClasses:Object.freeze(['UNSAFE_ACTION_REQUEST']),what:'no protected action is proposed without an authority reference (BLOCKING otherwise)'}),
  Object.freeze({checkerId:'COPILOT.TASK_NOT_EXPANDED',warningClasses:Object.freeze(['UNINTENDED_TASK_EXPANSION']),what:'no protected action names an authority reference the task context does not carry (BLOCKING otherwise)'}),
  Object.freeze({checkerId:'COPILOT.NO_AUTHORITY_VOICE',warningClasses:Object.freeze(['ROLE_CONFUSION']),what:'no asserted claim speaks with the voice of an authority (BLOCKING otherwise); reported speech is not flagged'})
]);
// Classes that need semantic judgement or inputs v0 does not receive. They are never emitted here.
const NOT_COVERED=Object.freeze(['INSTRUCTION_CONFLICT','CORRELATED_FAILURE_RISK']);
const pointer=text=>text.length<=MAX_POINTER?text:text.slice(0,MAX_POINTER);
const {sha256,canonical}=sentinel;

function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!sentinel.policy({maxEvidenceAgeMs:v.maxEvidenceAgeMs}))return null;
  return freezeDeep({maxEvidenceAgeMs:v.maxEvidenceAgeMs});
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
function warn(warningClass,severity,evidenceIds,pointerRef){
  const w=verdictContract.warning({warningClass,severity,checkerKind:'DETERMINISTIC',evidenceIds:evidenceIds.slice(0,64),pointerRef:pointer(pointerRef)});
  if(!w)throw new Error(`COPILOT_WARNING_INVALID:${warningClass}`);
  return w;
}
// The recommendation follows the accepted verdict contract: no warnings or INFO only -> ALLOW,
// WARN -> LABEL, BLOCKING -> BLOCK. ESCALATE is reserved for judgement under uncertainty, which a
// deterministic checker layer does not have.
function recommend(warnings){
  const highest=verdictContract.highestSeverity(warnings);
  return highest==='BLOCKING'?'BLOCK':highest==='WARN'?'LABEL':'ALLOW';
}
function issue(meta,warnings){
  const v=verdictContract.snapshot({version:verdictContract.VERSION,verdictId:meta.verdictId,taskRef:meta.taskRef,draftHash:meta.draftHash,warnings:warnings.map(w=>({...w,evidenceIds:[...w.evidenceIds]})),recommendation:recommend(warnings),issuedAt:meta.issuedAt,authority:'NONE'});
  if(!v)throw new Error('COPILOT_VERDICT_INVALID');
  return v;
}
function seal(record){return freezeDeep({...record,reviewDigest:sha256(canonical(record))});}
function blocked(meta,reasonCode){
  // A verdict can only be issued for a known task and a known draft; otherwise there is none and a
  // gate that requires one fails closed on its own.
  let verdict=null;
  if(meta.verdictId!==null&&meta.taskRef!==null&&meta.draftHash!==null)verdict=issue(meta,[warn('PROVENANCE_GAP','BLOCKING',[],`review:blocked:${reasonCode}`)]);
  return seal({
    version:REVIEW_VERSION,reviewId:meta.reviewId,taskRef:meta.taskRef,status:'BLOCKED',failClosed:true,reasonCode,verdict,
    checkers:CHECKERS.map(c=>({checkerId:c.checkerId,outcome:'NOT_RUN',warningCount:0})),notCovered:[...NOT_COVERED],warningsTruncated:0,observation:meta.observation,
    provenance:{copilotVersion:VERSION,checkersetVersion:CHECKERSET_VERSION,sentinelVersion:sentinel.VERSION,inputDigest:meta.inputDigest,contextTaskId:meta.taskRef,evidenceSetId:meta.evidenceSetId,draftId:meta.draftId,draftHash:meta.draftHash,observationDigest:meta.observation?meta.observation.reportDigest:null,priorReviewDigest:meta.priorReviewDigest,policy:meta.policy},
    issuedAt:meta.issuedAt,authority:'NONE',rewrites:false,approves:false,callsModel:false
  });
}

// review(input) -> CoPilotReview. Never throws; untrustworthy input yields a BLOCKED review that names why.
function review(input){
  const meta={reviewId:'invalid',verdictId:null,taskRef:null,issuedAt:0,evidenceSetId:null,draftId:null,draftHash:null,priorReviewDigest:null,policy:null,inputDigest:null,observation:null};
  try{return evaluate(input,meta);}catch{return blocked({...meta,verdictId:null},'INTERNAL_INVARIANT_VIOLATED');}
}
function evaluate(input,meta){
  const v=own(INPUT_FIELDS,input);
  if(!v||v.version!==INPUT_VERSION||!id(v.reviewId)||!id(v.verdictId)||!time(v.issuedAt)||!nullableHash(v.priorReviewDigest))return blocked(meta,'INPUT_INVALID');
  Object.assign(meta,{reviewId:v.reviewId,verdictId:v.verdictId,issuedAt:v.issuedAt,priorReviewDigest:v.priorReviewDigest});
  const pol=policy(v.policy);if(!pol)return blocked(meta,'POLICY_INVALID');meta.policy=pol;
  const ctx=taskContext.snapshot(v.context);if(!ctx)return blocked(meta,'CONTEXT_INVALID');meta.taskRef=ctx.taskId;
  const set=v.evidenceSet===null?null:evidenceSet.snapshot(v.evidenceSet);
  if(v.evidenceSet!==null&&!set)return blocked(meta,'EVIDENCE_SET_INVALID');
  if(set)meta.evidenceSetId=set.setId;
  const d=draft(v.draft);if(!d)return blocked(meta,'DRAFT_INVALID');
  Object.assign(meta,{draftId:d.draftId,draftHash:d.draftHash});
  const admitted={version:INPUT_VERSION,reviewId:v.reviewId,verdictId:v.verdictId,issuedAt:v.issuedAt,context:ctx,evidenceSet:set,draft:d,policy:pol,priorReviewDigest:v.priorReviewDigest};
  meta.inputDigest=sha256(canonical(admitted));
  if(taskContext.isExpired(ctx,v.issuedAt))return blocked(meta,'CONTEXT_EXPIRED');
  if(set&&set.taskRef!==ctx.taskId)return blocked(meta,'EVIDENCE_TASK_MISMATCH');

  // Observation engine: Sentinel v0 over the same context, evidence and claims.
  const observation=sentinel.observe({version:sentinel.INPUT_VERSION,observationId:v.reviewId,tap:'POST_DRAFT',observedAt:v.issuedAt,context:ctx,evidenceSet:set,claims:d.claims.map(c=>({...c,evidenceIds:[...c.evidenceIds]})),policy:{maxEvidenceAgeMs:pol.maxEvidenceAgeMs},priorReportDigest:null});
  meta.observation=observation;
  if(observation.status!=='OBSERVED')return blocked(meta,`OBSERVATION_${observation.reasonCode}`);

  const byId=new Set((set?set.items:[]).map(i=>i.evidenceId));
  const results=new Map(CHECKERS.map(c=>[c.checkerId,[]]));
  const add=(checkerId,w)=>results.get(checkerId).push(w);
  for(const f of observation.flags)add('COPILOT.SENTINEL_FLAGS',warn(f.warningClass,f.severity,[...f.evidenceIds],f.pointerRef));
  const usedByClaims=new Set(d.claims.flatMap(c=>c.evidenceIds));const cited=new Set(d.citations.map(c=>c.evidenceId));
  for(const c of d.citations){
    if(!byId.has(c.evidenceId))add('COPILOT.CITATIONS_RESOLVE',warn('SOURCE_EVIDENCE_MISMATCH','BLOCKING',[],`citation:${c.citationId}:not-in-evidence-set`));
    else if(!usedByClaims.has(c.evidenceId))add('COPILOT.CITATIONS_USED',warn('SOURCE_EVIDENCE_MISMATCH','WARN',[c.evidenceId],`citation:${c.citationId}:unused-by-claims`));
  }
  for(const c of d.claims){
    if(c.assertionMode!=='ASSERTED')continue;
    const resolvable=c.evidenceIds.filter(x=>byId.has(x));
    if(resolvable.length&&!resolvable.some(x=>cited.has(x)))add('COPILOT.CLAIMS_CITED',warn('PROVENANCE_GAP','INFO',resolvable,`claim:${c.claimId}:evidence-not-cited`));
    if(c.text!==null&&AUTHORITY_VOICE.test(c.text))add('COPILOT.NO_AUTHORITY_VOICE',warn('ROLE_CONFUSION','BLOCKING',[],`claim:${c.claimId}:authority-voice`));
  }
  for(const a of d.proposedActions){
    if(!a.protected)continue;
    if(a.authorityRef===null)add('COPILOT.ACTIONS_SAFE',warn('UNSAFE_ACTION_REQUEST','BLOCKING',[],`action:${a.actionId}:no-authority-reference`));
    else if(!ctx.authorityRefs.includes(a.authorityRef))add('COPILOT.TASK_NOT_EXPANDED',warn('UNINTENDED_TASK_EXPANSION','BLOCKING',[],`action:${a.actionId}:authority-not-in-task-context`));
  }
  // The verdict contract caps the warning list; the most severe warnings are kept so that the
  // recommendation never weakens, and the number dropped is recorded.
  const all=CHECKERS.flatMap(c=>results.get(c.checkerId));
  const rank=w=>verdictContract.SEVERITIES.indexOf(w.severity);
  const kept=all.length<=MAX_WARNINGS?all:all.map((w,i)=>({w,i})).sort((x,y)=>rank(y.w)-rank(x.w)||x.i-y.i).slice(0,MAX_WARNINGS).map(x=>x.w);
  const verdict=issue(meta,kept);
  return seal({
    version:REVIEW_VERSION,reviewId:v.reviewId,taskRef:ctx.taskId,status:'REVIEWED',failClosed:false,reasonCode:'REVIEWED',verdict,
    checkers:CHECKERS.map(c=>{const ws=results.get(c.checkerId);return {checkerId:c.checkerId,outcome:ws.length?'WARNED':'CLEAR',warningCount:ws.length};}),notCovered:[...NOT_COVERED],warningsTruncated:all.length-kept.length,observation,
    provenance:{copilotVersion:VERSION,checkersetVersion:CHECKERSET_VERSION,sentinelVersion:sentinel.VERSION,inputDigest:meta.inputDigest,contextTaskId:ctx.taskId,evidenceSetId:set?set.setId:null,draftId:d.draftId,draftHash:d.draftHash,observationDigest:observation.reportDigest,priorReviewDigest:v.priorReviewDigest,policy:pol},
    issuedAt:v.issuedAt,authority:'NONE',rewrites:false,approves:false,callsModel:false
  });
}
// verifyReview(record): true only if the review, its embedded observation and its verdict are intact.
function verifyReview(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!hash(record.reviewDigest))return false;
  try{
    const {reviewDigest,...rest}=record;
    if(sha256(canonical(rest))!==reviewDigest)return false;
    if(rest.observation!==null&&!sentinel.verifyReport(rest.observation))return false;
    return rest.verdict===null||verdictContract.snapshot(JSON.parse(JSON.stringify(rest.verdict)))!==null;
  }catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,REVIEW_VERSION,CHECKERSET_VERSION,STATUSES,ACTION_CLASSES,ALWAYS_PROTECTED,INPUT_FIELDS,DRAFT_FIELDS,CITATION_FIELDS,ACTION_FIELDS,POLICY_FIELDS,DEFAULT_POLICY,CHECKERS,NOT_COVERED,AUTHORITY_VOICE,policy,citation,action,draft,review,verifyReview});

'use strict';
// Project 2 Phase 3.3 - Sentinel v0 (inert, observe-only).
// Owner GO "PROJECT 2 / PHASE 3.3 - SENTINEL v0 ONLY" (2026-09-17).
//
// Sentinel v0 is a pure, deterministic function over one observation input (task context,
// identified evidence set, claims). It classifies every claim with an explicit truth state, records
// provenance for every statement it makes, raises typed early-warning flags, and fails closed when
// its input cannot be trusted. It performs no I/O, calls no model, keeps no state, decides nothing,
// and never modifies prompts, routing, evidence, answers or authoritative state. Where it cannot
// observe something it says so (coverage PARTIAL + unobservable codes) instead of guessing.
const {createHash}=require('node:crypto');
const {own,id,hash,ref,time,oneOf,idList,nullableHash,freezeDeep}=require('../authority/exact');
const taskContext=require('../authority/task-context');
const evidenceSet=require('../authority/evidence-set');
const claimLabels=require('../authority/claim-labels');
const {dimension,classifyConflict}=require('../authority/authority-model');
const copilot=require('../authority/copilot-verdict');

const VERSION='sinbad-sentinel/0-v1';
const INPUT_VERSION='sinbad-sentinel-input/0-v1';
const REPORT_VERSION='sinbad-sentinel-report/0-v1';
const RULESET_VERSION='sinbad-sentinel-ruleset/0-v1';
const TAPS=Object.freeze(['INGRESS','POST_RETRIEVAL','POST_DRAFT','POST_GATE','DELIVERY']);
const ASSERTION_MODES=Object.freeze(['ASSERTED','REPORTED']);
const STATUSES=Object.freeze(['OBSERVED','BLOCKED']);
const SIGNALS=Object.freeze(['CLEAR','ATTENTION','RISK','BLOCKED']);
const COVERAGE=Object.freeze(['FULL','PARTIAL','NONE']);
const TRUTH_STATES=claimLabels.LABELS;
const INPUT_FIELDS=Object.freeze(['version','observationId','tap','observedAt','context','evidenceSet','claims','policy','priorReportDigest']);
const CLAIM_FIELDS=Object.freeze(['claimId','contentHash','text','evidenceIds','originRef','originScopeRef','assertionMode']);
const POLICY_FIELDS=Object.freeze(['maxEvidenceAgeMs']);
const MAX_CLAIMS=256,MAX_TEXT=8192,MAX_EVIDENCE_AGE_MS=366*24*60*60*1000,MAX_FLAG_EVIDENCE=64,MAX_POINTER=512;
const DEFAULT_POLICY=Object.freeze({maxEvidenceAgeMs:24*60*60*1000});
// Rules are signals with a proposed severity. Whether a FAIL blocks a real request is a future
// gate policy (Phase 3.4+), never this module's decision.
const RULES=Object.freeze([
  Object.freeze({ruleId:'SENTINEL.INPUT_ADMITTED',blocking:true,what:'input is exact, internally consistent and observable at observedAt'}),
  Object.freeze({ruleId:'SENTINEL.EVIDENCE_SET_PRESENT',blocking:false,what:'claims are accompanied by an identified evidence set'}),
  Object.freeze({ruleId:'SENTINEL.EVIDENCE_IN_SCOPE',blocking:false,what:'no evidence item comes from a foreign evidence scope'}),
  Object.freeze({ruleId:'SENTINEL.EVIDENCE_FRESH',blocking:false,what:'no evidence item is older than policy.maxEvidenceAgeMs'}),
  Object.freeze({ruleId:'SENTINEL.EVIDENCE_CONSISTENT',blocking:false,what:'no locator was observed with two different contents'}),
  Object.freeze({ruleId:'SENTINEL.PROVENANCE_RESOLVABLE',blocking:true,what:'every referenced evidence id exists in the evidence set'}),
  Object.freeze({ruleId:'SENTINEL.CLAIMS_SUPPORTED',blocking:false,what:'every asserted claim is VERIFIED by eligible observed evidence'}),
  Object.freeze({ruleId:'SENTINEL.NO_UNSUPPORTED_SPECIFICS',blocking:true,what:'no asserted claim states specific values (hashes, ids, dates, versions) without eligible observed evidence'}),
  Object.freeze({ruleId:'SENTINEL.RESERVED_TERMS_BOUND',blocking:true,what:'reserved terms (VERIFIED, PASS, MERGED, ...) appear only in VERIFIED asserted claims'}),
  Object.freeze({ruleId:'SENTINEL.NO_FOREIGN_ADOPTION',blocking:true,what:'no claim from a foreign scope is asserted without in-scope verification'})
]);
// Specific values that a model cannot know without evidence: hex digests (at least one digit),
// pull-request or issue numbers, ISO dates and semantic versions.
const SPECIFIC_VALUE=/(?<![\p{L}\p{N}])(?:(?=[a-f]*\d)[a-f0-9]{7,64}|#\d{1,7}|\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?|v?\d+\.\d+\.\d+)(?![\p{L}\p{N}])/iu;

const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
const pointer=text=>text.length<=MAX_POINTER?text:text.slice(0,MAX_POINTER);
const capIds=ids=>ids.slice(0,MAX_FLAG_EVIDENCE);

function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!Number.isSafeInteger(v.maxEvidenceAgeMs)||v.maxEvidenceAgeMs<1||v.maxEvidenceAgeMs>MAX_EVIDENCE_AGE_MS)return null;
  return freezeDeep({maxEvidenceAgeMs:v.maxEvidenceAgeMs});
}
function claim(input){
  const v=own(CLAIM_FIELDS,input);
  if(!v||!id(v.claimId)||!hash(v.contentHash)||!(v.text===null||(typeof v.text==='string'&&v.text.length>=1&&v.text.length<=MAX_TEXT))||!idList(v.evidenceIds)||!ref(v.originRef)||!ref(v.originScopeRef)||!oneOf(ASSERTION_MODES,v.assertionMode))return null;
  return freezeDeep({claimId:v.claimId,contentHash:v.contentHash,text:v.text,evidenceIds:[...v.evidenceIds],originRef:v.originRef,originScopeRef:v.originScopeRef,assertionMode:v.assertionMode});
}
function flag(warningClass,severity,evidenceIds,pointerRef){
  const w=copilot.warning({warningClass,severity,checkerKind:'DETERMINISTIC',evidenceIds:capIds(evidenceIds),pointerRef:pointer(pointerRef)});
  if(!w)throw new Error(`SENTINEL_FLAG_INVALID:${warningClass}`);
  return w;
}
function ruleResult(ruleId,failed,detail){
  const rule=RULES.find(r=>r.ruleId===ruleId);
  return {ruleId,outcome:failed?'FAIL':'PASS',blocking:rule.blocking,detailRef:failed&&detail?pointer(detail):null};
}
function seal(report){
  const digest=sha256(canonical(report));
  return freezeDeep({...report,reportDigest:digest});
}
function blocked(meta,reasonCode){
  return seal({
    version:REPORT_VERSION,reportId:meta.observationId,tap:meta.tap,taskRef:meta.taskRef,status:'BLOCKED',failClosed:true,reasonCode,signal:'BLOCKED',coverage:'NONE',unobservable:[reasonCode],
    claims:[],evidence:null,flags:[],ruleResults:[ruleResult('SENTINEL.INPUT_ADMITTED',true,`reason:${reasonCode}`)],
    provenance:{sentinelVersion:VERSION,rulesetVersion:RULESET_VERSION,inputDigest:meta.inputDigest,contextTaskId:meta.taskRef,evidenceSetId:meta.evidenceSetId,priorReportDigest:meta.priorReportDigest,policy:meta.policy},
    observedAt:meta.observedAt,authority:'NONE',decides:false
  });
}

// observe(input) -> SentinelReport. Never throws on bad input: invalid or untrustworthy inputs yield
// a BLOCKED (fail-closed) report that names the reason.
function observe(input){
  const meta={observationId:'invalid',tap:'INGRESS',taskRef:null,evidenceSetId:null,priorReportDigest:null,policy:null,observedAt:0,inputDigest:null};
  try{return evaluate(input,meta);}catch{return blocked(meta,'INTERNAL_INVARIANT_VIOLATED');}
}
function evaluate(input,meta){
  const v=own(INPUT_FIELDS,input);
  if(!v||v.version!==INPUT_VERSION||!id(v.observationId)||!oneOf(TAPS,v.tap)||!time(v.observedAt)||!nullableHash(v.priorReportDigest)||!Array.isArray(v.claims)||v.claims.length>MAX_CLAIMS)return blocked(meta,'INPUT_INVALID');
  Object.assign(meta,{observationId:v.observationId,tap:v.tap,observedAt:v.observedAt,priorReportDigest:v.priorReportDigest});
  const pol=policy(v.policy);if(!pol)return blocked(meta,'POLICY_INVALID');meta.policy=pol;
  const ctx=taskContext.snapshot(v.context);if(!ctx)return blocked(meta,'CONTEXT_INVALID');meta.taskRef=ctx.taskId;
  const set=v.evidenceSet===null?null:evidenceSet.snapshot(v.evidenceSet);
  if(v.evidenceSet!==null&&!set)return blocked(meta,'EVIDENCE_SET_INVALID');
  if(set)meta.evidenceSetId=set.setId;
  const claims=v.claims.map(claim);
  if(claims.some(c=>!c))return blocked(meta,'CLAIMS_INVALID');
  if(new Set(claims.map(c=>c.claimId)).size!==claims.length)return blocked(meta,'CLAIMS_DUPLICATE');
  const admitted={version:INPUT_VERSION,observationId:v.observationId,tap:v.tap,observedAt:v.observedAt,context:ctx,evidenceSet:set,claims,policy:pol,priorReportDigest:v.priorReportDigest};
  meta.inputDigest=sha256(canonical(admitted));
  // Semantic integrity: fail closed when the observation cannot be trusted as a whole.
  if(claims.some(c=>c.text!==null&&sha256(c.text)!==c.contentHash))return blocked(meta,'CLAIM_CONTENT_HASH_MISMATCH');
  if(taskContext.isExpired(ctx,v.observedAt))return blocked(meta,'CONTEXT_EXPIRED');
  if(set&&set.taskRef!==ctx.taskId)return blocked(meta,'EVIDENCE_TASK_MISMATCH');
  if(set&&(set.retrievedAt>v.observedAt||set.items.some(i=>i.observedAt>v.observedAt)))return blocked(meta,'EVIDENCE_TIME_INCONSISTENT');

  // Evidence-level observation.
  const items=set?set.items:[];
  const byId=new Map(items.map(i=>[i.evidenceId,i]));
  const foreign=new Set(set?evidenceSet.foreignItems(set,ctx):[]);
  const stale=new Set(items.filter(i=>i.observedAt<v.observedAt-pol.maxEvidenceAgeMs).map(i=>i.evidenceId));
  const byLocator=new Map();
  for(const i of items){if(!byLocator.has(i.locatorRef))byLocator.set(i.locatorRef,[]);byLocator.get(i.locatorRef).push(i);}
  const driftedLocators=[];const drifted=new Set();
  for(const [locatorRef,group] of byLocator){
    if(new Set(group.map(i=>i.contentHash)).size<2)continue;
    const [a,b]=group;const kind=classifyConflict(a.sourceClass,b.sourceClass);
    driftedLocators.push({locatorRef,evidenceIds:group.map(i=>i.evidenceId),conflictKind:kind.kind,resolution:kind.resolution});
    for(const i of group)drifted.add(i.evidenceId);
  }
  const flags=[];const unobservable=[];
  if(set===null&&claims.length){unobservable.push('EVIDENCE_SET_NOT_PROVIDED');flags.push(flag('PROVENANCE_GAP','WARN',[],'evidence-set:not-provided'));}
  if(foreign.size)flags.push(flag('CONTEXT_MISMATCH','WARN',[...foreign],`evidence:foreign-scope:count=${foreign.size}`));
  if(stale.size)flags.push(flag('STALE_AUTHORITATIVE_STATE','WARN',[...stale],`evidence:stale:count=${stale.size}:maxAgeMs=${pol.maxEvidenceAgeMs}`));
  for(const d of driftedLocators)flags.push(flag('CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','WARN',d.evidenceIds,`locator:${d.locatorRef}`));

  // Claim-level observation.
  const fails={unresolvable:[],unsupported:[],specifics:[],reserved:[],foreignAdoption:[]};
  const claimRecords=claims.map(c=>{
    const record={claimId:c.claimId,contentHash:c.contentHash,assertionMode:c.assertionMode,originRef:c.originRef,originScopeRef:c.originScopeRef,foreignOrigin:c.originScopeRef!==ctx.evidenceScopeRef,truthState:null,reasonCode:null,evidenceIds:[...c.evidenceIds],eligibleEvidenceIds:[],foreignEvidenceIds:[],staleEvidenceIds:[],unknownEvidenceIds:[],nonAuthoritativeEvidenceIds:[],conflictEvidenceIds:[],reservedTerms:[],specificValues:null,flagRefs:[],unobservable:[]};
    const asserted=c.assertionMode==='ASSERTED';
    const addFlag=(warningClass,severity,evidenceIds,tail)=>{const f=flag(warningClass,severity,evidenceIds,`claim:${c.claimId}:${tail}`);flags.push(f);record.flagRefs.push(f.pointerRef);};
    if(c.text===null){record.unobservable.push('CLAIM_TEXT_NOT_PROVIDED');}
    else{record.reservedTerms=[...claimLabels.detectReservedTerms(c.text)];record.specificValues=SPECIFIC_VALUE.test(c.text);}
    if(set===null&&c.evidenceIds.length){
      record.truthState='NOT_VERIFIED';record.reasonCode='EVIDENCE_SET_NOT_PROVIDED';record.unobservable.push('EVIDENCE_NOT_RESOLVABLE_WITHOUT_SET');
    }else{
      record.unknownEvidenceIds=c.evidenceIds.filter(x=>!byId.has(x));
      if(record.unknownEvidenceIds.length){
        record.truthState='BLOCKED';record.reasonCode='UNKNOWN_EVIDENCE';fails.unresolvable.push(c.claimId);
        addFlag('PROVENANCE_GAP','BLOCKING',record.unknownEvidenceIds,'unknown-evidence');
      }else{
        const bound=c.evidenceIds.map(x=>byId.get(x));
        record.foreignEvidenceIds=bound.filter(i=>foreign.has(i.evidenceId)).map(i=>i.evidenceId);
        record.staleEvidenceIds=bound.filter(i=>stale.has(i.evidenceId)).map(i=>i.evidenceId);
        record.nonAuthoritativeEvidenceIds=bound.filter(i=>dimension(i.sourceClass)==='NONE').map(i=>i.evidenceId);
        const eligible=bound.filter(i=>!foreign.has(i.evidenceId)&&!stale.has(i.evidenceId));
        record.eligibleEvidenceIds=eligible.map(i=>i.evidenceId);
        record.conflictEvidenceIds=eligible.filter(i=>drifted.has(i.evidenceId)).map(i=>i.evidenceId);
        const label=claimLabels.labelClaim({claimId:c.claimId,evidenceClasses:eligible.map(i=>i.sourceClass),conflict:record.conflictEvidenceIds.length>0,applicable:true});
        record.truthState=label.label;record.reasonCode=label.reasonCode;
        if(label.label==='SOURCE_MISSING'&&bound.length){record.truthState='NOT_VERIFIED';record.reasonCode='ELIGIBLE_EVIDENCE_MISSING_STALE_OR_FOREIGN';}
        if(label.label==='CONFLICT')addFlag('CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','WARN',record.conflictEvidenceIds,'evidence-conflict');
        if(asserted&&eligible.length&&!eligible.some(i=>dimension(i.sourceClass)==='OBSERVED')&&eligible.some(i=>dimension(i.sourceClass)==='NORMATIVE'))addFlag('SOURCE_EVIDENCE_MISMATCH','WARN',eligible.map(i=>i.evidenceId),'normative-source-used-as-fact');
      }
    }
    if(asserted&&record.truthState!=='VERIFIED'&&record.truthState!=='CONFLICT'&&record.truthState!=='BLOCKED'){
      const specific=record.specificValues===true;
      fails.unsupported.push(c.claimId);if(specific)fails.specifics.push(c.claimId);
      addFlag('UNSUPPORTED_FACTUAL_ASSERTION',specific?'BLOCKING':'WARN',record.eligibleEvidenceIds,`${record.reasonCode}${specific?':specific-values':''}`);
    }
    if(asserted&&record.reservedTerms.length&&record.truthState!=='VERIFIED'){
      fails.reserved.push(c.claimId);addFlag('FALSE_CERTAINTY','BLOCKING',record.eligibleEvidenceIds,`reserved-terms-unbound:${record.reservedTerms.join(',')}`);
    }
    if(record.foreignOrigin){
      if(asserted&&record.truthState!=='VERIFIED'){fails.foreignAdoption.push(c.claimId);addFlag('CONTEXT_MISMATCH','BLOCKING',record.eligibleEvidenceIds,'foreign-claim-adopted');}
      else addFlag('CONTEXT_MISMATCH','INFO',record.eligibleEvidenceIds,asserted?'foreign-claim-verified-in-scope':'foreign-claim-reported');
    }
    return record;
  });
  if(claimRecords.some(r=>r.unobservable.includes('CLAIM_TEXT_NOT_PROVIDED')))unobservable.push('CLAIM_TEXT_NOT_PROVIDED');

  const list=ids=>ids.length?`claims:${ids.join(',')}`:null;
  const ruleResults=[
    ruleResult('SENTINEL.INPUT_ADMITTED',false,null),
    ruleResult('SENTINEL.EVIDENCE_SET_PRESENT',set===null&&claims.length>0,'evidence-set:not-provided'),
    ruleResult('SENTINEL.EVIDENCE_IN_SCOPE',foreign.size>0,`evidence:${[...foreign].join(',')}`),
    ruleResult('SENTINEL.EVIDENCE_FRESH',stale.size>0,`evidence:${[...stale].join(',')}`),
    ruleResult('SENTINEL.EVIDENCE_CONSISTENT',driftedLocators.length>0,`locators:${driftedLocators.map(d=>d.locatorRef).join(',')}`),
    ruleResult('SENTINEL.PROVENANCE_RESOLVABLE',fails.unresolvable.length>0,list(fails.unresolvable)),
    ruleResult('SENTINEL.CLAIMS_SUPPORTED',fails.unsupported.length>0,list(fails.unsupported)),
    ruleResult('SENTINEL.NO_UNSUPPORTED_SPECIFICS',fails.specifics.length>0,list(fails.specifics)),
    ruleResult('SENTINEL.RESERVED_TERMS_BOUND',fails.reserved.length>0,list(fails.reserved)),
    ruleResult('SENTINEL.NO_FOREIGN_ADOPTION',fails.foreignAdoption.length>0,list(fails.foreignAdoption))
  ];
  const highest=copilot.highestSeverity(flags);
  const signal=highest==='BLOCKING'?'RISK':highest==='WARN'?'ATTENTION':'CLEAR';
  const truthStateCounts={};for(const state of TRUTH_STATES)truthStateCounts[state]=claimRecords.filter(r=>r.truthState===state).length;
  return seal({
    version:REPORT_VERSION,reportId:v.observationId,tap:v.tap,taskRef:ctx.taskId,status:'OBSERVED',failClosed:false,reasonCode:'OBSERVED',signal,coverage:unobservable.length?'PARTIAL':'FULL',unobservable,
    claims:claimRecords,truthStateCounts,
    evidence:{setRef:set?set.setId:null,itemCount:items.length,foreignEvidenceIds:[...foreign],staleEvidenceIds:[...stale],driftedLocators},
    flags,ruleResults,
    provenance:{sentinelVersion:VERSION,rulesetVersion:RULESET_VERSION,inputDigest:meta.inputDigest,contextTaskId:ctx.taskId,evidenceSetId:set?set.setId:null,priorReportDigest:v.priorReportDigest,policy:pol},
    observedAt:v.observedAt,authority:'NONE',decides:false
  });
}
// verifyReport(report): recomputes the digest of a report; true only if the record is intact.
function verifyReport(report){
  if(!report||typeof report!=='object'||Array.isArray(report)||!hash(report.reportDigest))return false;
  try{const {reportDigest,...rest}=report;return sha256(canonical(rest))===reportDigest;}catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,REPORT_VERSION,RULESET_VERSION,TAPS,ASSERTION_MODES,STATUSES,SIGNALS,COVERAGE,TRUTH_STATES,INPUT_FIELDS,CLAIM_FIELDS,POLICY_FIELDS,MAX_CLAIMS,DEFAULT_POLICY,RULES,SPECIFIC_VALUE,sha256,canonical,claim,policy,observe,verifyReport});

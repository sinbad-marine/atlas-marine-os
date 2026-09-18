'use strict';
// Project 2 Phase 3.7 - Offline Chain v0 (inert, deterministic paper-only composition).
// Owner GO 2026-09-18: the Owner delegated the choice of the next phase and approved it; the
// scope chosen is "PROJECT 2 / PHASE 3.7 - OFFLINE CHAIN v0 ONLY".
//
// Offline Chain v0 is a pure, deterministic function that composes the four accepted inert
// components in memory, on data the caller supplies: for each supplied draft it asks Co-Pilot v0
// for a review, hands the verdict to Gatekeeper v0 (both observe through Sentinel v0), hands both
// sealed records to Pilot v0, and follows the Pilot's recommendation to the next supplied draft -
// until the Pilot says PROCEED, ESCALATE_OWNER or STOP, or the supplied drafts run out. The result
// is one sealed transcript. It is a rehearsal on paper: it produces no draft (every draft is
// input), calls no model, performs no I/O, reads no clock, keeps no state, delivers nothing,
// executes, approves and grants nothing, is not wired anywhere and fails closed.
const {own,id,time,nullableHash,hash,freezeDeep}=require('../authority/exact');
const {sha256,canonical}=require('../sentinel/sentinel-v0');
const copilot=require('../copilot/copilot-v0');
const gatekeeper=require('../gatekeeper/gatekeeper-v0');
const pilot=require('../pilot/pilot-v0');

const VERSION='sinbad-offline-chain/0-v1';
const INPUT_VERSION='sinbad-offline-chain-input/0-v1';
const TRANSCRIPT_VERSION='sinbad-offline-chain-transcript/0-v1';
const OUTCOMES=Object.freeze(['PROCEED','ESCALATE_OWNER','STOP','AWAITING_DRAFT']);
const TERMINAL=Object.freeze(['PROCEED','ESCALATE_OWNER','STOP']);
const INPUT_FIELDS=Object.freeze(['version','chainId','at','context','passes','policy','priorTranscriptDigest']);
const PASS_FIELDS=Object.freeze(['evidenceSet','draft']);
const POLICY_FIELDS=Object.freeze(['maxEvidenceAgeMs','volatileMaxEvidenceAgeMs','maxIterations','labelledDelivery']);
const MAX_CHAIN_ID=96;
const DEFAULT_POLICY=Object.freeze({...gatekeeper.DEFAULT_POLICY,...pilot.DEFAULT_POLICY});

function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!gatekeeper.policy({maxEvidenceAgeMs:v.maxEvidenceAgeMs,volatileMaxEvidenceAgeMs:v.volatileMaxEvidenceAgeMs})||!pilot.policy({maxIterations:v.maxIterations,labelledDelivery:v.labelledDelivery}))return null;
  return freezeDeep({maxEvidenceAgeMs:v.maxEvidenceAgeMs,volatileMaxEvidenceAgeMs:v.volatileMaxEvidenceAgeMs,maxIterations:v.maxIterations,labelledDelivery:v.labelledDelivery});
}
// The components admit only plain data and reject anything else themselves; the chain hands each of
// them its own plain copy so that no component can observe another one's input object.
function plainCopy(value){try{const text=JSON.stringify(value);return typeof text==='string'?JSON.parse(text):null;}catch{return null;}}
function seal(record){return freezeDeep({...record,transcriptDigest:sha256(canonical(record))});}
function conclude(meta,outcome,reasonCode,steps){
  return seal({
    version:TRANSCRIPT_VERSION,chainId:meta.chainId,taskRef:meta.taskRef,outcome,failClosed:outcome==='STOP',reasonCode,
    passesSupplied:meta.passesSupplied,passesRun:steps.length,passesUnused:Math.max(0,meta.passesSupplied-steps.length),steps,
    provenance:{chainVersion:VERSION,copilotVersion:copilot.VERSION,gatekeeperVersion:gatekeeper.VERSION,pilotVersion:pilot.VERSION,inputDigest:meta.inputDigest,priorTranscriptDigest:meta.priorTranscriptDigest,policy:meta.policy},
    at:meta.at,authority:'NONE',offlineOnly:true,producesDrafts:false,delivers:false,executes:false,approves:false,grantsAuthority:false,callsModel:false
  });
}

// rehearse(input) -> ChainTranscript. Never throws; untrustworthy input yields a sealed STOP.
function rehearse(input){
  const meta={chainId:'invalid',taskRef:null,at:0,passesSupplied:0,policy:null,inputDigest:null,priorTranscriptDigest:null};
  try{return evaluate(input,meta);}catch{return conclude(meta,'STOP','INTERNAL_INVARIANT_VIOLATED',[]);}
}
function evaluate(input,meta){
  const v=own(INPUT_FIELDS,input);
  if(!v||v.version!==INPUT_VERSION||!id(v.chainId)||v.chainId.length>MAX_CHAIN_ID||!time(v.at)||!nullableHash(v.priorTranscriptDigest)||!Array.isArray(v.passes))return conclude(meta,'STOP','INPUT_INVALID',[]);
  Object.assign(meta,{chainId:v.chainId,at:v.at,priorTranscriptDigest:v.priorTranscriptDigest,passesSupplied:v.passes.length});
  const pol=policy(v.policy);if(!pol)return conclude(meta,'STOP','POLICY_INVALID',[]);meta.policy=pol;
  if(v.passes.length<1||v.passes.length>pol.maxIterations)return conclude(meta,'STOP','PASSES_INVALID',[]);
  const passes=v.passes.map(x=>own(PASS_FIELDS,x));
  if(passes.some(x=>!x))return conclude(meta,'STOP','PASSES_INVALID',[]);
  const context=plainCopy(v.context);const data=passes.map(x=>({evidenceSet:x.evidenceSet===null?null:plainCopy(x.evidenceSet),draft:plainCopy(x.draft)}));
  if(context===null||data.some((x,i)=>x.draft===null||(passes[i].evidenceSet!==null&&x.evidenceSet===null)))return conclude(meta,'STOP','INPUT_NOT_PLAIN_DATA',[]);
  meta.inputDigest=sha256(canonical({version:INPUT_VERSION,chainId:v.chainId,at:v.at,context,passes:data,policy:pol,priorTranscriptDigest:v.priorTranscriptDigest}));

  const steps=[];let priorPilotDecisionDigest=null;
  for(let index=0;index<data.length;index+=1){
    const pass=data[index];const tag=`${v.chainId}.${index}`;
    const review=copilot.review({version:copilot.INPUT_VERSION,reviewId:`${tag}.review`,verdictId:`${tag}.verdict`,issuedAt:v.at,context:plainCopy(context),evidenceSet:plainCopy(pass.evidenceSet),draft:plainCopy(pass.draft),policy:{maxEvidenceAgeMs:pol.maxEvidenceAgeMs},priorReviewDigest:null});
    const gateDecision=gatekeeper.decide({version:gatekeeper.INPUT_VERSION,decisionId:`${tag}.gate`,observedAt:v.at,context:plainCopy(context),evidenceSet:plainCopy(pass.evidenceSet),draft:plainCopy(pass.draft),verdict:review.verdict===null?null:plainCopy(review.verdict),policy:{maxEvidenceAgeMs:pol.maxEvidenceAgeMs,volatileMaxEvidenceAgeMs:pol.volatileMaxEvidenceAgeMs},priorDecisionDigest:null});
    // The draft reference is what the gate admitted; a draft the gate could not identify has none, and the Pilot stops on that.
    const draftRef=gateDecision.provenance.draftHash===null?{draftId:'unidentified',draftHash:'0'.repeat(64)}:{draftId:gateDecision.provenance.draftId,draftHash:gateDecision.provenance.draftHash};
    const pilotDecision=pilot.decide({version:pilot.INPUT_VERSION,pilotDecisionId:`${tag}.pilot`,decidedAt:v.at,context:plainCopy(context),draftRef,gateDecision:plainCopy(gateDecision),review:plainCopy(review),iterationIndex:index,policy:{maxIterations:pol.maxIterations,labelledDelivery:pol.labelledDelivery},priorPilotDecisionDigest});
    priorPilotDecisionDigest=pilotDecision.pilotDecisionDigest;if(meta.taskRef===null)meta.taskRef=pilotDecision.taskRef;
    steps.push({index,draftId:gateDecision.provenance.draftId,draftHash:gateDecision.provenance.draftHash,
      review:{reviewDigest:review.reviewDigest,status:review.status,reasonCode:review.reasonCode,recommendation:review.verdict?review.verdict.recommendation:null,warningCount:review.verdict?review.verdict.warnings.length:0},
      gate:{decisionDigest:gateDecision.decisionDigest,outcome:gateDecision.outcome,reasonCode:gateDecision.reasonCode,deliveryLabel:gateDecision.deliveryLabel,labels:[...gateDecision.labels]},
      pilot:{pilotDecisionDigest:pilotDecision.pilotDecisionDigest,decision:pilotDecision.decision,ruleId:pilotDecision.ruleId,reasonCode:pilotDecision.reasonCode,carryLabels:[...pilotDecision.carryLabels],findings:pilotDecision.findings.map(f=>({...f}))},
      records:{review,gateDecision,pilotDecision}});
    if(TERMINAL.includes(pilotDecision.decision))return conclude(meta,pilotDecision.decision,pilotDecision.reasonCode,steps);
  }
  // The Pilot asked for another draft or more evidence and the caller supplied none: the rehearsal ends open.
  return conclude(meta,'AWAITING_DRAFT',steps[steps.length-1].pilot.reasonCode,steps);
}
// verifyTranscript(record): the transcript, every embedded record and the links between them are intact.
function verifyTranscript(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!hash(record.transcriptDigest))return false;
  try{
    const {transcriptDigest,...rest}=record;
    if(sha256(canonical(rest))!==transcriptDigest||!OUTCOMES.includes(rest.outcome)||rest.authority!=='NONE'||rest.executes!==false||!Array.isArray(rest.steps)||rest.passesRun!==rest.steps.length)return false;
    let prior=null;
    for(const s of rest.steps){
      const r=s.records;
      if(!copilot.verifyReview(r.review)||!gatekeeper.verifyDecision(r.gateDecision)||!pilot.verifyPilotDecision(r.pilotDecision))return false;
      if(s.review.reviewDigest!==r.review.reviewDigest||s.gate.decisionDigest!==r.gateDecision.decisionDigest||s.pilot.pilotDecisionDigest!==r.pilotDecision.pilotDecisionDigest)return false;
      // A Pilot that refused its input before reading the records binds none of them; otherwise the digests must match.
      const bound=r.pilotDecision.provenance;
      if((bound.gateDecisionDigest!==null&&bound.gateDecisionDigest!==r.gateDecision.decisionDigest)||(bound.reviewDigest!==null&&bound.reviewDigest!==r.review.reviewDigest)||bound.priorPilotDecisionDigest!==prior)return false;
      if(bound.gateDecisionDigest===null&&r.pilotDecision.decision!=='STOP')return false;
      if(s.pilot.decision!==r.pilotDecision.decision||s.gate.outcome!==r.gateDecision.outcome)return false;
      prior=r.pilotDecision.pilotDecisionDigest;
    }
    const last=rest.steps[rest.steps.length-1];
    if(!last)return rest.outcome==='STOP';
    return TERMINAL.includes(last.pilot.decision)?rest.outcome===last.pilot.decision:rest.outcome==='AWAITING_DRAFT';
  }catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,TRANSCRIPT_VERSION,OUTCOMES,TERMINAL,INPUT_FIELDS,PASS_FIELDS,POLICY_FIELDS,DEFAULT_POLICY,policy,rehearse,verifyTranscript});

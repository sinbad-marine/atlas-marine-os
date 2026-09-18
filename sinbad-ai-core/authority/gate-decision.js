'use strict';
// GateDecision: deterministic composition of rule results (Gatekeeper) and, optionally, a Co-Pilot
// verdict into one attributable outcome. Rules and verdicts are recorded separately; a decision is
// always traceable to either a rule id or a verdict id. The decision itself executes nothing.
const {own,id,time,bool,oneOf,freezeDeep}=require('./exact');
const copilot=require('./copilot-verdict');
const VERSION='sinbad-gate-decision/1-v1';
const STAGES=Object.freeze(['PRE','POST']);
const RULE_OUTCOMES=Object.freeze(['PASS','FAIL','SKIP']);
const OUTCOMES=Object.freeze(['ADMIT','LABEL','ESCALATE','BLOCK']);
const RULE_FIELDS=Object.freeze(['ruleId','outcome','blocking','detailRef']);
const REQUEST_FIELDS=Object.freeze(['decisionId','taskRef','stage','rules','verdict','protectedAction','decidedAt']);
const MAX_RULES=128;

function rule(input){
  const v=own(RULE_FIELDS,input);
  if(!v||!id(v.ruleId)||!oneOf(RULE_OUTCOMES,v.outcome)||!bool(v.blocking)||(v.detailRef!==null&&!(typeof v.detailRef==='string'&&v.detailRef.length>=1&&v.detailRef.length<=512)))return null;
  return freezeDeep({ruleId:v.ruleId,outcome:v.outcome,blocking:v.blocking,detailRef:v.detailRef});
}
function blocked(decisionId,taskRef,stage,reasonCode,decidedAt){
  return freezeDeep({version:VERSION,decisionId,taskRef,stage,outcome:'BLOCK',labels:['BLOCKED'],ruleResults:[],verdictRef:null,attribution:{deterministicRuleIds:[],modelVerdictId:null,reasonCode},failClosed:true,decidedAt,authority:'NONE'});
}
function decide(input){
  const v=own(REQUEST_FIELDS,input);
  if(!v||!id(v.decisionId)||!id(v.taskRef)||!oneOf(STAGES,v.stage)||!Array.isArray(v.rules)||v.rules.length>MAX_RULES||!bool(v.protectedAction)||!time(v.decidedAt))return blocked('invalid','invalid','PRE','REQUEST_INVALID',0);
  const rules=v.rules.map(rule);
  if(rules.some(r=>!r)||new Set(rules.map(r=>r.ruleId)).size!==rules.length)return blocked(v.decisionId,v.taskRef,v.stage,'RULES_INVALID',v.decidedAt);
  const verdict=v.verdict===null?null:copilot.snapshot(v.verdict);
  if(v.verdict!==null&&!verdict)return blocked(v.decisionId,v.taskRef,v.stage,'VERDICT_INVALID',v.decidedAt);
  if(verdict&&verdict.taskRef!==v.taskRef)return blocked(v.decisionId,v.taskRef,v.stage,'VERDICT_TASK_MISMATCH',v.decidedAt);
  const failedBlocking=rules.filter(r=>r.outcome==='FAIL'&&r.blocking).map(r=>r.ruleId);
  const failedSoft=rules.filter(r=>r.outcome==='FAIL'&&!r.blocking).map(r=>r.ruleId);
  const highest=verdict?copilot.highestSeverity(verdict.warnings):null;
  let outcome='ADMIT',labels=[],reasonCode='ALL_CLEAR',failClosed=false;
  if(failedBlocking.length){outcome='BLOCK';labels=['BLOCKED'];reasonCode='DETERMINISTIC_RULE_FAILED';failClosed=true;}
  else if(v.protectedAction&&v.stage==='POST'&&!verdict){outcome='BLOCK';labels=['BLOCKED'];reasonCode='VERDICT_MISSING_FOR_PROTECTED_ACTION';failClosed=true;}
  else if(highest==='BLOCKING'){if(v.protectedAction){outcome='BLOCK';labels=['BLOCKED'];reasonCode='MODEL_VERDICT_BLOCKING_ON_PROTECTED_ACTION';failClosed=true;}else{outcome=verdict.recommendation==='ESCALATE'?'ESCALATE':'LABEL';labels=['NOT_VERIFIED'];reasonCode='MODEL_VERDICT_BLOCKING';}}
  else if(failedSoft.length||highest==='WARN'){outcome='LABEL';labels=['NOT_VERIFIED'];reasonCode=failedSoft.length?'DETERMINISTIC_RULE_SOFT_FAIL':'MODEL_VERDICT_WARNING';}
  return freezeDeep({version:VERSION,decisionId:v.decisionId,taskRef:v.taskRef,stage:v.stage,outcome,labels,ruleResults:rules,verdictRef:verdict?verdict.verdictId:null,attribution:{deterministicRuleIds:[...failedBlocking,...failedSoft],modelVerdictId:(reasonCode.startsWith('MODEL_VERDICT')&&verdict)?verdict.verdictId:null,reasonCode},failClosed,decidedAt:v.decidedAt,authority:'NONE'});
}
module.exports=Object.freeze({VERSION,STAGES,RULE_OUTCOMES,OUTCOMES,rule,decide});

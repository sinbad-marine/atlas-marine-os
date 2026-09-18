'use strict';
// CoPilotVerdict: the only output of the future Co-Pilot. It carries typed warnings and a
// recommendation; it has no authority (cannot approve, execute, rewrite or override), and the
// checker kind of every warning is recorded so deterministic checks are never mixed with model
// judgement in a decision's attribution.
const {own,id,hash,time,oneOf,idList,freezeDeep}=require('./exact');
const VERSION='sinbad-copilot-verdict/1-v1';
const WARNING_CLASSES=Object.freeze(['CONTEXT_MISMATCH','SOURCE_EVIDENCE_MISMATCH','UNSUPPORTED_FACTUAL_ASSERTION','STALE_AUTHORITATIVE_STATE','CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','FALSE_CERTAINTY','PROVENANCE_GAP','INSTRUCTION_CONFLICT','ROLE_CONFUSION','UNINTENDED_TASK_EXPANSION','UNSAFE_ACTION_REQUEST','CORRELATED_FAILURE_RISK']);
const SEVERITIES=Object.freeze(['INFO','WARN','BLOCKING']);
const RECOMMENDATIONS=Object.freeze(['ALLOW','LABEL','ESCALATE','BLOCK']);
const CHECKER_KINDS=Object.freeze(['DETERMINISTIC','MODEL']);
const WARNING_FIELDS=Object.freeze(['warningClass','severity','checkerKind','evidenceIds','pointerRef']);
const FIELDS=Object.freeze(['version','verdictId','taskRef','draftHash','warnings','recommendation','issuedAt','authority']);
const MAX_WARNINGS=128;

function warning(input){
  const v=own(WARNING_FIELDS,input);
  if(!v||!oneOf(WARNING_CLASSES,v.warningClass)||!oneOf(SEVERITIES,v.severity)||!oneOf(CHECKER_KINDS,v.checkerKind)||!idList(v.evidenceIds)||(v.pointerRef!==null&&!(typeof v.pointerRef==='string'&&v.pointerRef.length>=1&&v.pointerRef.length<=512)))return null;
  return freezeDeep({warningClass:v.warningClass,severity:v.severity,checkerKind:v.checkerKind,evidenceIds:[...v.evidenceIds],pointerRef:v.pointerRef});
}
function snapshot(input){
  const v=own(FIELDS,input);
  if(!v||v.version!==VERSION||!id(v.verdictId)||!id(v.taskRef)||!hash(v.draftHash)||!Array.isArray(v.warnings)||v.warnings.length>MAX_WARNINGS||!oneOf(RECOMMENDATIONS,v.recommendation)||!time(v.issuedAt)||v.authority!=='NONE')return null;
  const warnings=v.warnings.map(warning);
  if(warnings.some(w=>!w))return null;
  const highest=highestSeverity(warnings);
  // Consistency: no warnings -> ALLOW only; a BLOCKING warning -> BLOCK or ESCALATE only; WARN -> not ALLOW.
  if(!warnings.length&&v.recommendation!=='ALLOW')return null;
  if(highest==='BLOCKING'&&!['BLOCK','ESCALATE'].includes(v.recommendation))return null;
  if(highest==='WARN'&&v.recommendation==='ALLOW')return null;
  return freezeDeep({version:VERSION,verdictId:v.verdictId,taskRef:v.taskRef,draftHash:v.draftHash,warnings,recommendation:v.recommendation,issuedAt:v.issuedAt,authority:'NONE'});
}
function highestSeverity(warnings){let rank=-1;for(const w of warnings||[]){const r=SEVERITIES.indexOf(w.severity);if(r>rank)rank=r;}return rank<0?null:SEVERITIES[rank];}
function checkerKinds(verdict){const v=snapshot(verdict);if(!v)return Object.freeze([]);return Object.freeze([...new Set(v.warnings.map(w=>w.checkerKind))]);}
module.exports=Object.freeze({VERSION,WARNING_CLASSES,SEVERITIES,RECOMMENDATIONS,CHECKER_KINDS,warning,snapshot,highestSeverity,checkerKinds});

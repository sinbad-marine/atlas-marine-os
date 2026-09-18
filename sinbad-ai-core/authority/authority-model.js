'use strict';
// Project 2 authority model (Owner correction 2026-09-15, docs/project2/ARCHITECTURE_AUTHORITY_MODEL.md).
// Two separate dimensions: NORMATIVE sources decide what is authorized or intended; OBSERVED sources
// decide what is factually the case. Model memory and inference belong to neither. This module only
// classifies; it grants nothing and verifies nothing.
const VERSION='sinbad-authority-model/1-v1';
const DIMENSIONS=Object.freeze(['NORMATIVE','OBSERVED','NONE']);
const SOURCE_CLASSES=Object.freeze({
  OWNER_DIRECTIVE:'NORMATIVE',GOVERNANCE_POLICY:'NORMATIVE',AUTHORIZATION:'NORMATIVE',RELEASE_DECISION:'NORMATIVE',
  LIVE_SYSTEM:'OBSERVED',DATABASE:'OBSERVED',REPOSITORY:'OBSERVED',TEST_CI:'OBSERVED',DOCUMENT:'OBSERVED',EXTERNAL_AUTHORITATIVE_SOURCE:'OBSERVED',
  MODEL_MEMORY:'NONE',MODEL_INFERENCE:'NONE'
});
// Quality order applies ONLY between OBSERVED classes reporting the same fact; it is not a precedence
// over NORMATIVE sources and never turns an observation into an authorization.
const OBSERVED_QUALITY=Object.freeze(['LIVE_SYSTEM','DATABASE','REPOSITORY','TEST_CI','DOCUMENT','EXTERNAL_AUTHORITATIVE_SOURCE']);
const CONFLICT_KINDS=Object.freeze(['OBSERVED_CONFLICT','NORMATIVE_CONFLICT_OWNER_ESCALATION','CROSS_DIMENSION_NOT_A_CONFLICT','NON_AUTHORITATIVE_INPUT','INVALID']);

const isSourceClass=value=>typeof value==='string'&&Object.hasOwn(SOURCE_CLASSES,value);
function dimension(sourceClass){return isSourceClass(sourceClass)?SOURCE_CLASSES[sourceClass]:null;}
function canAuthorize(sourceClass){return dimension(sourceClass)==='NORMATIVE';}
function canEstablishFact(sourceClass){return dimension(sourceClass)==='OBSERVED';}
function describe(sourceClass){
  if(!isSourceClass(sourceClass))return null;
  const d=SOURCE_CLASSES[sourceClass];
  return Object.freeze({version:VERSION,sourceClass,dimension:d,canAuthorize:d==='NORMATIVE',canEstablishFact:d==='OBSERVED',observedQualityRank:d==='OBSERVED'?OBSERVED_QUALITY.indexOf(sourceClass):null});
}
// Classifies a disagreement between two sources. A NORMATIVE statement that a server is ONLINE and an
// OBSERVED reading that it is not are not a conflict: both are recorded (intended X, observed Y).
function classifyConflict(sourceClassA,sourceClassB){
  const a=dimension(sourceClassA),b=dimension(sourceClassB);
  if(!a||!b)return Object.freeze({version:VERSION,kind:'INVALID',resolution:null});
  if(a==='NONE'||b==='NONE')return Object.freeze({version:VERSION,kind:'NON_AUTHORITATIVE_INPUT',resolution:'DISCARD_NON_AUTHORITATIVE'});
  if(a!==b)return Object.freeze({version:VERSION,kind:'CROSS_DIMENSION_NOT_A_CONFLICT',resolution:'RECORD_BOTH_REPORT_GAP'});
  if(a==='NORMATIVE')return Object.freeze({version:VERSION,kind:'NORMATIVE_CONFLICT_OWNER_ESCALATION',resolution:'OWNER_DECISION_REQUIRED'});
  const ra=OBSERVED_QUALITY.indexOf(sourceClassA),rb=OBSERVED_QUALITY.indexOf(sourceClassB);
  return Object.freeze({version:VERSION,kind:'OBSERVED_CONFLICT',resolution:ra===rb?'CONFLICT_UNRESOLVED_SAME_QUALITY':'PREFER_HIGHER_QUALITY_OBSERVATION',preferred:ra===rb?null:(ra<rb?sourceClassA:sourceClassB)});
}
module.exports=Object.freeze({VERSION,DIMENSIONS,SOURCE_CLASSES,OBSERVED_QUALITY,CONFLICT_KINDS,isSourceClass,dimension,canAuthorize,canEstablishFact,describe,classifyConflict});

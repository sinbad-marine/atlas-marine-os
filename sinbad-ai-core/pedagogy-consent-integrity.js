'use strict';
const foundation=require('./pedagogy-foundation-integrity.js');
const pedagogy=require('./pedagogy-animation-contracts.js');
const memory=require('./task-'+'memory-lifecycle-contracts.js');
const KEYS=Object.freeze(['expectedTenantId','expectedVesselId','expectedPersonId','expectedConsentScopeRef','expectedNow','profile','lessonState','pedagogyDecision','animationIntent','descriptor','retentionPolicy','isolationContext','knowledgeClaim','consent']);
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u,id=v=>typeof v==='string'&&ID.test(v),time=v=>Number.isSafeInteger(v)&&v>=0;
const consentScope=(tenantId,vesselId,personId)=>`${tenantId}:${vesselId}:${personId}:LEARNING`;
function exact(input){try{if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)return null;const names=Object.getOwnPropertyNames(input),d=Object.getOwnPropertyDescriptors(input);if(names.length!==KEYS.length||KEYS.some(k=>!names.includes(k)||!d[k]||!Object.hasOwn(d[k],'value')||d[k].enumerable!==true))return null;return Object.fromEntries(KEYS.map(k=>[k,d[k].value]));}catch{return null;}}
function evaluate(input){
  const result=(status,stage,reasonCode,stageReasonCode=null)=>Object.freeze({status,stage,reasonCode,stageReasonCode,consentCandidateBound:false,consentVerified:false,profileGovernanceVerified:false,knowledgeGroundingVerified:false,pedagogyDecisionVerified:false,adaptiveInstructionAllowed:false,animationRenderingAllowed:false,identityRecognitionAllowed:false,biometricCaptureAllowed:false,liveCaptureAllowed:false,activationAllowed:false});
  const blocked=(stage,reasonCode,stageReasonCode=null)=>result('PEDAGOGY_CONSENT_INTEGRITY_BLOCKED',stage,reasonCode,stageReasonCode);
  const fault=()=>result('PEDAGOGY_CONSENT_INTEGRITY_FAULT','ASSESSOR','ASSESSOR_FAULT');
  try{
    const r=exact(input);
    if(!r||!id(r.expectedTenantId)||!id(r.expectedVesselId)||!id(r.expectedPersonId)||!id(r.expectedConsentScopeRef)||r.expectedConsentScopeRef!==consentScope(r.expectedTenantId,r.expectedVesselId,r.expectedPersonId)||!time(r.expectedNow))return blocked('REQUEST','REQUEST_INVALID');
    const profile=pedagogy.snapshot('LearningProfileCandidate',r.profile),consent=memory.snapshot('ConsentCandidate',r.consent);
    if(!profile)return blocked('PROFILE','PROFILE_SNAPSHOT_INVALID');
    if(!consent)return blocked('CONSENT','CONSENT_SNAPSHOT_INVALID');
    if(profile.tenantId!==r.expectedTenantId||profile.vesselId!==r.expectedVesselId||profile.personId!==r.expectedPersonId)return blocked('CROSS_BINDING','PROFILE_SCOPE_MISMATCH');
    if(profile.consentRef!==consent.consentId||consent.ownerId!==profile.personId||consent.profileId!==profile.profileId||consent.profileRevision!==profile.revision||consent.purposeRef!==profile.purposeRef||consent.scopeRef!==r.expectedConsentScopeRef)return blocked('CROSS_BINDING','CONSENT_PROFILE_SCOPE_MISMATCH');
    if(consent.status!=='CANDIDATE'||consent.grantedAt>r.expectedNow||consent.grantedAt>=profile.createdAt||consent.expiresAt<=r.expectedNow)return blocked('CONSENT','CONSENT_NOT_USABLE');
    const baseInput=Object.fromEntries(KEYS.filter(k=>k!=='expectedConsentScopeRef'&&k!=='consent').map(k=>[k,r[k]]));
    const base=foundation.evaluate(baseInput);
    if(base.status!=='PEDAGOGY_FOUNDATION_INTEGRITY_BLOCKED'||base.stage!=='COMPLETE_CANDIDATE_GRAPH'||base.reasonCode!=='CONSENT_GOVERNANCE_SOURCE_CURRENCY_INDEPENDENT_CHECK_HUMAN_REVIEW_AND_RENDERER_ASSURANCE_REQUIRED')return blocked('FOUNDATION','FOUNDATION_STAGE_INVALID',base&&typeof base.reasonCode==='string'?base.reasonCode:null);
    const lifecycle=memory.evaluateProfileUse({expectedNow:r.expectedNow,consent:r.consent,conflict:null,exception:null});
    if(lifecycle.status!=='TASK_MEMORY_USE_BLOCKED'||lifecycle.reasonCode!=='CONSENT_STORE_PROFILE_AND_REGRESSION_VERIFICATION_REQUIRED')return blocked('CONSENT','CONSENT_LIFECYCLE_STAGE_INVALID',lifecycle&&typeof lifecycle.reasonCode==='string'?lifecycle.reasonCode:null);
    return blocked('COMPLETE_CANDIDATE_GRAPH','CONSENT_AUTHENTICITY_STORE_REVOCATION_CONFLICT_REGRESSION_AUDIT_HUMAN_REVIEW_AND_RENDERER_ASSURANCE_REQUIRED',lifecycle.reasonCode);
  }catch{return fault();}
}
module.exports=Object.freeze({evaluate});

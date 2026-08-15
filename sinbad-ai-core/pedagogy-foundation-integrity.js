'use strict';
const pedagogy=require('./pedagogy-animation-contracts.js');
const governance=require('./sensitive-data-governance-contracts.js');
const truth=require('./truth-stop-task-contracts.js');
const KEYS=Object.freeze(['expectedTenantId','expectedVesselId','expectedPersonId','expectedNow','profile','lessonState','pedagogyDecision','animationIntent','descriptor','retentionPolicy','isolationContext','knowledgeClaim']);
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const CLAIM_REASONS=Object.freeze(['CLAIM_INVALID','KNOWLEDGE_UNKNOWN','VERIFIED_FACT_REQUIRED','SOURCE_EVIDENCE_REQUIRED','SOURCE_CURRENCY_APPLICABILITY_AND_INDEPENDENT_CHECK_REQUIRED']);
const id=v=>typeof v==='string'&&ID.test(v),time=v=>Number.isSafeInteger(v)&&v>=0;
function exact(input){try{if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)return null;const names=Object.getOwnPropertyNames(input),d=Object.getOwnPropertyDescriptors(input);if(names.length!==KEYS.length||KEYS.some(k=>!names.includes(k)||!d[k]||!Object.hasOwn(d[k],'value')||d[k].enumerable!==true))return null;return Object.fromEntries(KEYS.map(k=>[k,d[k].value]));}catch{return null;}}
function evaluate(input){
  const result=(status,stage,reasonCode,stageReasonCode=null)=>Object.freeze({status,stage,reasonCode,stageReasonCode,profileGovernanceVerified:false,consentVerified:false,isolationVerified:false,knowledgeGroundingVerified:false,pedagogyDecisionVerified:false,adaptiveInstructionAllowed:false,animationRenderingAllowed:false,identityRecognitionAllowed:false,biometricCaptureAllowed:false,liveCaptureAllowed:false,activationAllowed:false});
  const blocked=(stage,reasonCode,stageReasonCode=null)=>result('PEDAGOGY_FOUNDATION_INTEGRITY_BLOCKED',stage,reasonCode,stageReasonCode);
  const fault=()=>result('PEDAGOGY_FOUNDATION_INTEGRITY_FAULT','ASSESSOR','ASSESSOR_FAULT');
  try{
    const r=exact(input);
    if(!r||!id(r.expectedTenantId)||!id(r.expectedVesselId)||!id(r.expectedPersonId)||!time(r.expectedNow))return blocked('REQUEST','REQUEST_INVALID');
    const profile=pedagogy.snapshot('LearningProfileCandidate',r.profile),state=pedagogy.snapshot('LessonStateCandidate',r.lessonState),decision=pedagogy.snapshot('PedagogyDecisionCandidate',r.pedagogyDecision),animation=pedagogy.snapshot('AnimationIntentCandidate',r.animationIntent);
    if(!profile||!state||!decision||!animation)return blocked('PEDAGOGY','PEDAGOGY_SNAPSHOT_INVALID');
    const descriptor=governance.snapshot('SensitiveDataDescriptor',r.descriptor),policy=governance.snapshot('RetentionPolicyCandidate',r.retentionPolicy),isolation=governance.snapshot('IsolationContextCandidate',r.isolationContext);
    if(!descriptor||!policy||!isolation)return blocked('GOVERNANCE','GOVERNANCE_SNAPSHOT_INVALID');
    const claim=truth.snapshot('TruthClaim',r.knowledgeClaim);
    if(!claim)return blocked('GROUNDING','KNOWLEDGE_CLAIM_SNAPSHOT_INVALID');
    if(profile.status!=='UNVERIFIED'||state.status!=='UNVERIFIED'||decision.status!=='UNVERIFIED'||animation.status!=='DRAFT'||descriptor.status!=='CANDIDATE'||policy.status!=='DRAFT'||isolation.status!=='UNVERIFIED'||claim.status!=='CANDIDATE')return blocked('CONTRACT','CANDIDATE_STATUS_DRIFT');
    for(const value of [profile,state,decision,animation,descriptor,policy,isolation])if(value.tenantId!==r.expectedTenantId||value.vesselId!==r.expectedVesselId||value.personId!==r.expectedPersonId)return blocked('CROSS_BINDING','TENANT_VESSEL_PERSON_SCOPE_MISMATCH');
    if(state.learningProfileRef!==profile.profileId||decision.learningProfileRef!==profile.profileId||decision.lessonStateRef!==state.lessonStateId||animation.pedagogyDecisionRef!==decision.decisionId)return blocked('CROSS_BINDING','PEDAGOGY_REFERENCE_MISMATCH');
    if(profile.sensitiveDataDescriptorRef!==descriptor.descriptorId||profile.retentionPolicyRef!==policy.policyId||profile.isolationContextRef!==isolation.contextId||descriptor.resourceRef!==profile.profileId||isolation.resourceRef!==profile.profileId||isolation.descriptorRef!==descriptor.descriptorId||isolation.policyRef!==policy.policyId)return blocked('CROSS_BINDING','PROFILE_GOVERNANCE_REFERENCE_MISMATCH');
    if(descriptor.dataDomain!=='LEARNING'||policy.dataDomain!=='LEARNING'||descriptor.dataClass!==policy.dataClass||profile.purposeRef!==descriptor.purposeRef||profile.purposeRef!==policy.purposeRef||profile.purposeRef!==isolation.purposeRef)return blocked('CROSS_BINDING','LEARNING_CLASSIFICATION_PURPOSE_MISMATCH');
    if(decision.knowledgeGroundingRef!==claim.claimId||claim.scopeRef!==state.lessonRef)return blocked('CROSS_BINDING','KNOWLEDGE_GROUNDING_REFERENCE_MISMATCH');
    if(!(descriptor.classifiedAt<=isolation.createdAt&&isolation.createdAt<=profile.createdAt&&profile.createdAt<=state.observedAt&&state.observedAt<=claim.observedAt&&claim.observedAt<=decision.decidedAt&&decision.decidedAt<=animation.createdAt&&animation.createdAt<=r.expectedNow)||isolation.expiresAt<=r.expectedNow||policy.reviewAt<=r.expectedNow||policy.retainUntil<=r.expectedNow)return blocked('CROSS_BINDING','GOVERNANCE_GROUNDING_TIME_SCOPE_INVALID');
    const pedagogical=pedagogy.evaluate({expectedTenantId:r.expectedTenantId,expectedVesselId:r.expectedVesselId,expectedPersonId:r.expectedPersonId,expectedNow:r.expectedNow,profile:r.profile,lessonState:r.lessonState,pedagogyDecision:r.pedagogyDecision,animationIntent:r.animationIntent});
    if(pedagogical.status!=='PEDAGOGY_ANIMATION_SEPARATION_BLOCKED'||pedagogical.reasonCode!=='CONSENT_ISOLATION_GROUNDING_PEDAGOGY_HUMAN_REVIEW_AND_RENDERER_ASSURANCE_REQUIRED')return blocked('PEDAGOGY','PEDAGOGY_STAGE_INVALID',pedagogical&&typeof pedagogical.reasonCode==='string'?pedagogical.reasonCode:null);
    const claimGate=truth.criticalClaimGate(r.knowledgeClaim);
    if(claimGate.status!=='SAFE_STOP_REQUIRED'||!CLAIM_REASONS.includes(claimGate.reasonCode))return blocked('GROUNDING','KNOWLEDGE_GATE_INVALID');
    return blocked('COMPLETE_CANDIDATE_GRAPH','CONSENT_GOVERNANCE_SOURCE_CURRENCY_INDEPENDENT_CHECK_HUMAN_REVIEW_AND_RENDERER_ASSURANCE_REQUIRED',claimGate.reasonCode);
  }catch{return fault();}
}
module.exports=Object.freeze({evaluate});

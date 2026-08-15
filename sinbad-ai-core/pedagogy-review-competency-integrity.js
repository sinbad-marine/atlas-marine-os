'use strict';
const {createHash}=require('node:crypto');
const pedagogy=require('./pedagogy-animation-contracts.js');
const governance=require('./governance-contracts.js');
const KEYS=Object.freeze(['expectedTenantId','expectedVesselId','expectedPersonId','expectedRequirementId','expectedNow','profile','lessonState','competencyEvidence','humanReview']);
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u,id=v=>typeof v==='string'&&ID.test(v),time=v=>Number.isSafeInteger(v)&&v>=0;
const progressRef=(tenantId,vesselId,profileId,personId)=>`progress:${createHash('sha256').update(JSON.stringify([tenantId,vesselId,profileId,personId,'PROGRESS'])).digest('hex')}`;
function exact(input){try{if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)return null;const names=Object.getOwnPropertyNames(input),d=Object.getOwnPropertyDescriptors(input);if(names.length!==KEYS.length||KEYS.some(k=>!names.includes(k)||!d[k]||!Object.hasOwn(d[k],'value')||d[k].enumerable!==true))return null;return Object.fromEntries(KEYS.map(k=>[k,d[k].value]));}catch{return null;}}
function evaluate(input){
  const result=(status,stage,reasonCode,stageReasonCode=null,bound=false)=>Object.freeze({status,stage,reasonCode,stageReasonCode,competencyEvidenceBound:bound,humanReviewBound:bound,competencyVerified:false,humanReviewVerified:false,lessonCompleted:false,certificateAllowed:false,adaptiveInstructionAllowed:false,animationRenderingAllowed:false,activationAllowed:false});
  const blocked=(stage,reasonCode,stageReasonCode=null,bound=false)=>result('PEDAGOGY_REVIEW_COMPETENCY_BLOCKED',stage,reasonCode,stageReasonCode,bound);
  const fault=()=>result('PEDAGOGY_REVIEW_COMPETENCY_FAULT','ASSESSOR','ASSESSOR_FAULT');
  try{
    const r=exact(input);
    if(!r||!id(r.expectedTenantId)||!id(r.expectedVesselId)||!id(r.expectedPersonId)||!id(r.expectedRequirementId)||!time(r.expectedNow))return blocked('REQUEST','REQUEST_INVALID');
    const profile=pedagogy.snapshot('LearningProfileCandidate',r.profile),state=pedagogy.snapshot('LessonStateCandidate',r.lessonState);
    if(!profile||!state)return blocked('PEDAGOGY','PEDAGOGY_SNAPSHOT_INVALID');
    const evidence=governance.snapshot('EvidenceCandidate',r.competencyEvidence),review=governance.snapshot('ApprovalCandidate',r.humanReview);
    if(!evidence||!review)return blocked('REVIEW','REVIEW_SNAPSHOT_INVALID');
    if(profile.tenantId!==r.expectedTenantId||profile.vesselId!==r.expectedVesselId||profile.personId!==r.expectedPersonId||state.tenantId!==r.expectedTenantId||state.vesselId!==r.expectedVesselId||state.personId!==r.expectedPersonId)return blocked('CROSS_BINDING','PEDAGOGY_SCOPE_MISMATCH');
    if(evidence.tenantId!==r.expectedTenantId||evidence.vesselId!==r.expectedVesselId||review.tenantId!==r.expectedTenantId||review.vesselId!==r.expectedVesselId||evidence.requirementId!==r.expectedRequirementId||review.requirementId!==r.expectedRequirementId)return blocked('CROSS_BINDING','REVIEW_SCOPE_MISMATCH');
    if(!['PLANNED','PAUSED'].includes(state.state)||state.progressEvidenceRef!==progressRef(profile.tenantId,profile.vesselId,profile.profileId,profile.personId)||state.learningProfileRef!==profile.profileId||profile.competencyEvidenceRef!==evidence.evidenceId||evidence.evidenceType!=='COMPETENCY_OBSERVATION'||evidence.contentRef!==state.progressEvidenceRef||review.evidenceRef!==evidence.evidenceId)return blocked('CROSS_BINDING','COMPETENCY_REVIEW_REFERENCE_MISMATCH');
    if(profile.status!=='UNVERIFIED'||state.status!=='UNVERIFIED'||evidence.status!=='UNVERIFIED'||review.status!=='PENDING'||review.signatureRef!==null)return blocked('REVIEW','CANDIDATE_STATE_INVALID');
    if(evidence.expiresAt===null||state.observedAt>evidence.collectedAt||evidence.collectedAt>review.requestedAt||review.requestedAt>r.expectedNow||evidence.expiresAt<=r.expectedNow)return blocked('CROSS_BINDING','REVIEW_TIME_SCOPE_INVALID');
    const assessment=governance.evaluateApprovalScope({expectedTenantId:r.expectedTenantId,expectedVesselId:r.expectedVesselId,expectedRequirementId:r.expectedRequirementId,expectedNow:r.expectedNow,approval:review,evidence});
    if(!assessment)return fault();
    if(assessment.status!=='GOVERNANCE_APPROVAL_BLOCKED'||assessment.reasonCode!=='VERIFICATION_SIGNATURE_AND_AUTHORIZATION_REQUIRED')return blocked('REVIEW','GOVERNANCE_REVIEW_STAGE_INVALID',assessment&&typeof assessment.reasonCode==='string'?assessment.reasonCode:null);
    return blocked('COMPLETE_CANDIDATE_GRAPH','COMPETENCY_PROVENANCE_ASSESSMENT_POLICY_QUALIFIED_HUMAN_SIGNATURE_AUTHORIZATION_AND_AUDIT_REQUIRED',assessment.reasonCode,true);
  }catch{return fault();}
}
module.exports=Object.freeze({evaluate});

/* Shared Human Review decision. A role name is not authority.
   A developer record must name the person, workspace and purpose.
   This file does not read SQL and is not a live backend bypass. */
(function(root){
  'use strict';
  function humanReviewAccessDecision(member,authorization){
    const execute=false;
    const active=member?.is_active===true||member?.isActive===true;
    if(!member||!active)return {allow:false,execute,reason:'MEMBERSHIP_REQUIRED'};
    if(member.role==='owner')return {allow:true,execute,role:'OWNER',reason:'ACTIVE_OWNER_MEMBERSHIP'};
    if(member.role!=='developer')return {allow:false,execute,reason:'REVIEW_ACCESS_DENIED'};
    if(!authorization||typeof authorization!=='object')return {allow:false,execute,reason:'REVIEW_AUTHORIZATION_ABSENT'};
    if(authorization.kind&&authorization.kind!=='server-verified-decision')return {allow:false,execute,reason:'REVIEW_BINDING_ABSENT'};
    const purpose=authorization.purpose;
    const userId=authorization.userId;
    const workspaceId=authorization.workspaceId;
    if(typeof purpose!=='string'||!purpose||typeof userId!=='string'||!userId||typeof workspaceId!=='string'||!workspaceId)return {allow:false,execute,reason:'REVIEW_BINDING_ABSENT'};
    if(typeof member.userId!=='string'||!member.userId||typeof member.workspaceId!=='string'||!member.workspaceId)return {allow:false,execute,reason:'REVIEW_BINDING_ABSENT'};
    if(purpose!=='human_review')return {allow:false,execute,reason:'REVIEW_PURPOSE_MISMATCH'};
    if(userId!==member.userId)return {allow:false,execute,reason:'REVIEW_SUBJECT_MISMATCH'};
    if(workspaceId!==member.workspaceId)return {allow:false,execute,reason:'REVIEW_WORKSPACE_MISMATCH'};
    if(authorization.state==='revoked')return {allow:false,execute,reason:'REVIEW_REVOKED'};
    if(authorization.state==='suspended')return {allow:false,execute,reason:'REVIEW_SUSPENDED'};
    if(authorization.expiresAt){
      const exp=Date.parse(authorization.expiresAt);
      const now=Date.parse(member.now||authorization.now||'');
      if(!Number.isFinite(exp)||!Number.isFinite(now)||exp<=now)return {allow:false,execute,reason:'REVIEW_EXPIRED'};
    }
    if(authorization.state!=='active')return {allow:false,execute,reason:'REVIEW_ACCESS_DENIED'};
    if(authorization.kind==='server-verified-decision'&&authorization.allow!==true)return {allow:false,execute,reason:'REVIEW_ACCESS_DENIED'};
    return {allow:true,execute,role:'AUTHORIZED_DEVELOPER',reason:'ACTIVE_PERSON_AUTHORIZATION'};
  }
  root.humanReviewAccessDecision=humanReviewAccessDecision;
})(typeof globalThis!=='undefined'?globalThis:this);

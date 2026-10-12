/* Pure membership-scope decisions for the dashboard.
   Session, membership, observation authority and evidence time are different.
   A late answer cannot gain a new authority, and a filled role name is not that authority.
   This file does not query Supabase and does not grant access. */
(function(root){
  'use strict';
  function acceptMembershipAnswer(input){
    const answer=input||{};
    if(answer.epoch!==answer.liveEpoch)return {accept:false,reason:'STALE_REQUEST'};
    if(!answer.requestedScope||answer.requestedScope!==answer.liveScope)return {accept:false,reason:'SCOPE_MISMATCH'};
    if(answer.error||answer.active!==true||!answer.role)return {accept:false,reason:'MEMBERSHIP_ABSENT'};
    return {accept:true,role:String(answer.role),verifiedScope:answer.requestedScope,reason:'VERIFIED_MEMBERSHIP'};
  }
  function settleMembership(state,answer){
    const current=state||{};
    const live=`${current.url||''}|${current.userId||''}|${current.workspaceId||''}`;
    const verdict=acceptMembershipAnswer({
      epoch:answer?.epoch,
      liveEpoch:current.epoch,
      requestedScope:answer?.requestedScope,
      liveScope:live,
      error:answer?.error===true,
      active:answer?.active===true,
      role:answer?.role||''
    });
    if(!verdict.accept){
      if(answer?.epoch===current.epoch&&answer?.requestedScope===live){
        return {...current,role:'',verifiedScope:'',reason:verdict.reason,applied:true};
      }
      return {...current,reason:verdict.reason,applied:false};
    }
    return {...current,role:verdict.role,verifiedScope:verdict.verifiedScope,reason:verdict.reason,applied:true};
  }
  function probePaintAllowed(paint){
    const input=paint||{};
    if(!input.scopeAtStart||input.scopeAtStart!==input.liveScope)return false;
    if(!input.verifiedScope||input.verifiedScope!==input.liveScope)return false;
    if(input.authorityAtStart!==input.authorityNow)return false;
    const decision=input.decision;
    if(!decision||decision.observe!==true||decision.execute!==false||decision.navigationOnly!==true)return false;
    if(input.surface&&decision.surface!==input.surface)return false;
    return true;
  }
  const api={acceptMembershipAnswer,settleMembership,probePaintAllowed};
  root.acceptMembershipAnswer=acceptMembershipAnswer;
  root.settleMembership=settleMembership;
  root.probePaintAllowed=probePaintAllowed;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

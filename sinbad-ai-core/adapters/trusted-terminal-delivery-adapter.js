'use strict';
const crypto=require('node:crypto');
const authorizer=require('../delivery/single-use-delivery-authorizer.js');
const gate=require('../delivery/terminal-completion-gate.js');
const state=require('./terminal-state-transition.js');
const ADAPTER_VERSION='sinbad-trusted-terminal-delivery-adapter/2X-v1';
const EXPECTED=Object.freeze({authorization:'sinbad-single-use-delivery-authorization/2O-v1',completion:'sinbad-terminal-completion-gate/2V-v1',transition:'sinbad-terminal-state-transition/2W-v1'});
if(authorizer.AUTHORIZATION_VERSION!==EXPECTED.authorization||gate.COMPLETION_VERSION!==EXPECTED.completion||state.TRANSITION_VERSION!==EXPECTED.transition)throw new Error('Unsupported trusted terminal delivery chain version');
function blocked(){return Object.freeze({version:ADAPTER_VERSION,status:'TRUSTED_TERMINAL_DELIVERY_BLOCKED',reasonCode:'TRUSTED_TERMINAL_DELIVERY_DENIED',terminalState:null,outcome:null,sourceCount:0,completionHash:null,transitionHash:null});}
function presentation(authorization){return Object.freeze({contentType:authorization.contentType,renderingPolicy:authorization.renderingPolicy,answer:authorization.answer,sources:authorization.sources});}
function create(options={}){
  if(!options||typeof options.present!=='function')throw new TypeError('A trusted present function is required');
  if(options.diagnose!==undefined&&typeof options.diagnose!=='function')throw new TypeError('diagnose must be a function');
  const present=options.present,diagnose=typeof options.diagnose==='function'?options.diagnose:()=>{};
  const inFlight=new WeakSet();
  function diagnostic(code){try{diagnose(Object.freeze({version:ADAPTER_VERSION,code}));}catch{}}
  async function deliver(authorization={}){
    if(!authorizer.isAuthenticAuthorization(authorization)||authorization.status!=='DELIVERY_AUTHORIZED'||inFlight.has(authorization))return blocked();
    inFlight.add(authorization);
    const context=Object.freeze({transactionId:authorization.transactionId,sessionId:authorization.sessionId,channelId:authorization.channelId,attemptId:crypto.randomUUID(),closureId:crypto.randomUUID(),auditId:crypto.randomUUID(),transitionId:crypto.randomUUID()});
    let outcome='FAILED';
    try{outcome=await present(presentation(authorization))===true?'DELIVERED':'FAILED';}catch{diagnostic('PRESENTATION_EXCEPTION');outcome='FAILED';}
    try{
      const completion=gate.complete(authorization,{...context,outcome});
      if(completion.status!=='TERMINAL_COMPLETION_CONFIRMED'){diagnostic('COMPLETION_DENIED');return blocked();}
      const transition=state.transition(completion,{...context,outcome});
      if(transition.status!=='TERMINAL_STATE_APPLIED'){diagnostic('TRANSITION_DENIED');return blocked();}
      return Object.freeze({version:ADAPTER_VERSION,status:'TRUSTED_TERMINAL_DELIVERY_APPLIED',reasonCode:null,terminalState:transition.terminalState,outcome:transition.outcome,sourceCount:transition.sourceCount,completionHash:transition.completionHash,transitionHash:transition.transitionHash});
    }catch{diagnostic('TERMINAL_CHAIN_EXCEPTION');return blocked();}
  }
  return Object.freeze({deliver});
}
module.exports=Object.freeze({ADAPTER_VERSION,EXPECTED,create});

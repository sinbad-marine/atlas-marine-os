'use strict';
const crypto=require('node:crypto');
const authorizer=require('../delivery/single-use-delivery-authorizer.js');
const gate=require('../delivery/terminal-completion-gate.js');
const state=require('./terminal-state-transition.js');
const stores=require('./durable-idempotency-store.js');
const ADAPTER_VERSION='sinbad-trusted-terminal-delivery-adapter/2Y-v1';
const IDEMPOTENCY_VERSION='sinbad-trusted-terminal-idempotency/2Y-v1';
const EXPECTED=Object.freeze({authorization:'sinbad-single-use-delivery-authorization/2O-v1',completion:'sinbad-terminal-completion-gate/2V-v1',transition:'sinbad-terminal-state-transition/2W-v1'});
if(authorizer.AUTHORIZATION_VERSION!==EXPECTED.authorization||gate.COMPLETION_VERSION!==EXPECTED.completion||state.TRANSITION_VERSION!==EXPECTED.transition)throw new Error('Unsupported trusted terminal delivery chain version');
function blocked(){return Object.freeze({version:ADAPTER_VERSION,status:'TRUSTED_TERMINAL_DELIVERY_BLOCKED',reasonCode:'TRUSTED_TERMINAL_DELIVERY_DENIED',terminalState:null,outcome:null,sourceCount:0,completionHash:null,transitionHash:null});}
function unsettled(input={}){return Object.freeze({version:ADAPTER_VERSION,status:'TRUSTED_TERMINAL_DELIVERY_UNSETTLED',reasonCode:'DURABLE_SETTLEMENT_REQUIRED',terminalState:input.terminalState||null,outcome:['DELIVERED','FAILED'].includes(input.outcome)?input.outcome:null,sourceCount:Number.isInteger(input.sourceCount)?input.sourceCount:0,completionHash:/^[a-f0-9]{64}$/u.test(input.completionHash||'')?input.completionHash:null,transitionHash:/^[a-f0-9]{64}$/u.test(input.transitionHash||'')?input.transitionHash:null});}
function idempotencyKey(authorization){return gate.sha256(gate.canonical({version:IDEMPOTENCY_VERSION,transactionId:authorization.transactionId,sessionId:authorization.sessionId,channelId:authorization.channelId,deliveryHash:authorization.deliveryHash}));}
function presentation(authorization){return Object.freeze({contentType:authorization.contentType,renderingPolicy:authorization.renderingPolicy,answer:authorization.answer,sources:authorization.sources});}
function create(options={}){
  if(!options||typeof options.present!=='function')throw new TypeError('A trusted present function is required');
  if(options.diagnose!==undefined&&typeof options.diagnose!=='function')throw new TypeError('diagnose must be a function');
  const present=options.present,diagnose=typeof options.diagnose==='function'?options.diagnose:()=>{},store=stores.validate(options.idempotencyStore);
  const inFlightKeys=new Set();
  function diagnostic(code){try{diagnose(Object.freeze({version:ADAPTER_VERSION,code}));}catch{}}
  async function settle(key,summary){try{if(await store.settle(key,Object.freeze(summary))===true)return true;diagnostic('IDEMPOTENCY_SETTLEMENT_DENIED');}catch{diagnostic('IDEMPOTENCY_SETTLEMENT_EXCEPTION');}return false;}
  async function deliver(authorization={}){
    if(!authorizer.isAuthenticAuthorization(authorization)||authorization.status!=='DELIVERY_AUTHORIZED')return blocked();
    const key=idempotencyKey(authorization);
    if(inFlightKeys.has(key))return blocked();inFlightKeys.add(key);
    try{if(await store.claim(key)!==true){diagnostic('IDEMPOTENCY_DENIED');return blocked();}}catch{diagnostic('IDEMPOTENCY_EXCEPTION');return blocked();}
    const context=Object.freeze({transactionId:authorization.transactionId,sessionId:authorization.sessionId,channelId:authorization.channelId,attemptId:crypto.randomUUID(),closureId:crypto.randomUUID(),auditId:crypto.randomUUID(),transitionId:crypto.randomUUID()});
    let outcome='FAILED';
    try{outcome=await present(presentation(authorization))===true?'DELIVERED':'FAILED';}catch{diagnostic('PRESENTATION_EXCEPTION');outcome='FAILED';}
    try{
      const completion=gate.complete(authorization,{...context,outcome});
      if(completion.status!=='TERMINAL_COMPLETION_CONFIRMED'){diagnostic('COMPLETION_DENIED');return await settle(key,{status:'TRUSTED_TERMINAL_DELIVERY_BLOCKED',outcome:null,stage:'COMPLETION_DENIED'})?blocked():unsettled({outcome});}
      const transition=state.transition(completion,{...context,outcome});
      if(transition.status!=='TERMINAL_STATE_APPLIED'){diagnostic('TRANSITION_DENIED');return await settle(key,{status:'TRUSTED_TERMINAL_DELIVERY_BLOCKED',outcome:null,stage:'TRANSITION_DENIED',completionHash:completion.completionHash})?blocked():unsettled({outcome,sourceCount:completion.sourceCount,completionHash:completion.completionHash});}
      const output=Object.freeze({version:ADAPTER_VERSION,status:'TRUSTED_TERMINAL_DELIVERY_APPLIED',reasonCode:null,terminalState:transition.terminalState,outcome:transition.outcome,sourceCount:transition.sourceCount,completionHash:transition.completionHash,transitionHash:transition.transitionHash});
      if(!await settle(key,{status:output.status,terminalState:output.terminalState,outcome:output.outcome,transitionHash:output.transitionHash}))return unsettled(output);
      return output;
    }catch{diagnostic('TERMINAL_CHAIN_EXCEPTION');return await settle(key,{status:'TRUSTED_TERMINAL_DELIVERY_BLOCKED',outcome:null,stage:'TERMINAL_CHAIN_EXCEPTION'})?blocked():unsettled({outcome});}
  }
  return Object.freeze({deliver});
}
module.exports=Object.freeze({ADAPTER_VERSION,IDEMPOTENCY_VERSION,EXPECTED,create});

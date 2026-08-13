'use strict';
const crypto=require('node:crypto');
const gate=require('../delivery/terminal-completion-gate.js');
const EXPECTED_COMPLETION_VERSION='sinbad-terminal-completion-gate/2V-v1';
if(gate.COMPLETION_VERSION!==EXPECTED_COMPLETION_VERSION)throw new Error(`Unsupported terminal completion version: ${gate.COMPLETION_VERSION}`);
const TRANSITION_VERSION='sinbad-terminal-state-transition/2W-v1';
const consumed=new WeakSet();
const authenticTransitions=new WeakSet();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=gate.clean;
function blocked(){return Object.freeze({version:TRANSITION_VERSION,status:'TERMINAL_STATE_BLOCKED',reasonCode:'TERMINAL_STATE_DENIED',terminalState:null,outcome:null,sourceCount:0,completionHash:null,transitionHash:null});}
function transition(completion={},context={}){const transitionId=clean(context.transitionId),snapshot=gate.boundSnapshot(completion,context);if(!transitionId||!snapshot||consumed.has(completion)||!['DELIVERED','FAILED'].includes(snapshot.outcome)||!/^[a-f0-9]{64}$/u.test(snapshot.completionHash))return blocked();const terminalState=snapshot.outcome==='DELIVERED'?'DELIVERY_SUCCEEDED':'DELIVERY_FAILED',manifest=Object.freeze({version:TRANSITION_VERSION,status:'TERMINAL_STATE_APPLIED',transitionId,transactionId:snapshot.transactionId,sessionId:snapshot.sessionId,channelId:snapshot.channelId,terminalState,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,completionHash:snapshot.completionHash});const output=Object.freeze({version:TRANSITION_VERSION,status:'TERMINAL_STATE_APPLIED',reasonCode:null,terminalState,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,completionHash:snapshot.completionHash,transitionHash:sha256(canonical(manifest))});consumed.add(completion);authenticTransitions.add(output);return output;}
function isAuthenticTransition(value){return Boolean(value&&typeof value==='object'&&authenticTransitions.has(value));}
module.exports=Object.freeze({EXPECTED_COMPLETION_VERSION,TRANSITION_VERSION,canonical,sha256,clean,transition,isAuthenticTransition});

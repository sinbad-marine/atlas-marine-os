'use strict';
const path=require('node:path');
const protocol=require('./local-model-protocol.js');
const gatewayModule=require('./local-model-loopback-gateway.js');
const validator=require('./local-model-artifact-validator.js');
const proposalWriterModule=require('./local-model-proposal-writer.js');
const nodeTransport=require('./node-loopback-http-transport.js');
const VERSION='0.2.0',MODE='GUIDED_PRO_LOCAL_MODEL_SESSION';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd())),clock=typeof options.clock==='function'?options.clock:Date.now;
  const gateway=gatewayModule.create({clock,transport:options.transport||nodeTransport.create().transport}),writer=proposalWriterModule.create({approvedBase,clock});
  let state='NEW',request=null,proposal=null;
  const snapshot=(status,nextAction,detail={})=>freeze({version:VERSION,mode:MODE,status,state,nextAction,...detail,capabilities:{loopbackModelDraft:true,validateArtifactProposal:true,persistIsolatedProposal:true,generatedCodeExecution:false,coreWrite:false,remoteNetwork:false,publish:false}});
  function prepare(input={}){if(state!=='NEW')return snapshot('PRO_MODEL_SESSION_BLOCKED','CREATE_NEW_SESSION',{reason:'SESSION_ALREADY_PREPARED'});try{request=protocol.createRequest(input);state='MODEL_CALL_READY';return snapshot('PRO_MODEL_CALL_READY','APPROVE_ONE_LOOPBACK_MODEL_CALL',{endpoint:request.endpoint,model:request.model,limits:request.limits});}catch(error){state='INPUT_BLOCKED';return snapshot('PRO_MODEL_SESSION_BLOCKED','REVISE_LOCAL_MODEL_INPUT',{reason:error?.message||'LOCAL_MODEL_INPUT_INVALID'});}}
  async function generate(approval={}){if(state!=='MODEL_CALL_READY')return snapshot('PRO_MODEL_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'MODEL_CALL_OUT_OF_ORDER'});try{const draft=await gateway.send(request,gateway.authorize(request,approval));proposal=validator.validate(draft);if(proposal.status!=='LOCAL_MODEL_ARTIFACT_PROPOSAL_VERIFIED_UNTRUSTED'){state='PROPOSAL_BLOCKED';return snapshot('PRO_MODEL_SESSION_BLOCKED','REVISE_MODEL_PROMPT_OR_OUTPUT',{reason:proposal.reason,issues:proposal.issues});}state='PROPOSAL_VERIFIED';return snapshot('PRO_MODEL_PROPOSAL_READY','APPROVE_ISOLATED_PROPOSAL_WRITE',{projectSlug:proposal.projectSlug,model:proposal.model,manifestHash:proposal.manifestHash,files:proposal.manifest.map(item=>item.path),authority:'DATA_ONLY'});}catch(error){return snapshot('PRO_MODEL_SESSION_BLOCKED','REVIEW_MODEL_CALL_APPROVAL_OR_LOCAL_RUNTIME',{reason:error?.message||'LOCAL_MODEL_CALL_FAILED'});}}
  async function persist(approval={}){if(state!=='PROPOSAL_VERIFIED')return snapshot('PRO_MODEL_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'PROPOSAL_WRITE_OUT_OF_ORDER'});try{const result=await writer.persist(proposal,writer.authorize(proposal,approval));state='PROPOSAL_PERSISTED';return snapshot('PRO_MODEL_PROPOSAL_PERSISTED_UNTRUSTED','HUMAN_REVIEW_PROPOSAL',{proposal:result.proposal,manifestHash:result.manifestHash,files:result.files,authority:'DATA_ONLY',executed:false,published:false});}catch(error){return snapshot('PRO_MODEL_SESSION_BLOCKED','REVIEW_PROPOSAL_WRITE_APPROVAL',{reason:error?.message||'PROPOSAL_WRITE_FAILED'});}}
  function status(){const actions={NEW:'PREPARE_LOCAL_MODEL_REQUEST',MODEL_CALL_READY:'APPROVE_ONE_LOOPBACK_MODEL_CALL',INPUT_BLOCKED:'CREATE_NEW_SESSION_WITH_REVISED_INPUT',PROPOSAL_BLOCKED:'CREATE_NEW_SESSION_WITH_REVISED_PROMPT',PROPOSAL_VERIFIED:'APPROVE_ISOLATED_PROPOSAL_WRITE',PROPOSAL_PERSISTED:'HUMAN_REVIEW_PROPOSAL'};return snapshot('PRO_MODEL_SESSION_STATUS',actions[state]||'STOP');}
  return freeze({VERSION,MODE,approvedBase,prepare,generate,persist,status});
}
module.exports=freeze({VERSION,MODE,create});

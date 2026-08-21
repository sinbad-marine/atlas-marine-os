'use strict';
const path=require('node:path');
const compiler=require('./virtual-artifact-compiler.js');
const staticVerifier=require('./static-artifact-verifier.js');
const sandboxWriter=require('./sandbox-writer.js');
const persistedVerifier=require('./persisted-workspace-verifier.js');
const previewPackager=require('./scriptless-preview-packager.js');
const previewWriter=require('./scriptless-preview-writer.js');

const VERSION='0.1.0';
const MODE='GUIDED_OFFLINE_STUDIO';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const sourceWriter=sandboxWriter.create({approvedBase,clock});
  const diskVerifier=persistedVerifier.create({approvedBase});
  const packager=previewPackager.create({approvedBase});
  const localPreviewWriter=previewWriter.create({approvedBase,clock});
  let state='NEW',bundle=null,staticReport=null,persistedReport=null,previewPackage=null;
  const snapshot=(status,nextAction,detail={})=>freeze({version:VERSION,mode:MODE,status,state,nextAction,...detail,capabilities:{plan:true,generateDraft:true,writeSandbox:true,verifyIntegrity:true,createScriptlessPreview:true,execute:false,network:false,publish:false,coreWrite:false}});

  function start(request={}){
    if(state!=='NEW')return snapshot('STUDIO_SESSION_BLOCKED','CREATE_NEW_SESSION',{reason:'SESSION_ALREADY_STARTED'});
    bundle=compiler.compile(request);
    if(bundle.status!=='VIRTUAL_ARTIFACTS_READY'){
      state='NEEDS_INPUT';
      return snapshot('STUDIO_INPUT_REQUIRED','ANSWER_CLARIFYING_QUESTIONS',{reason:bundle.reason,questions:bundle.plan.questions||[],approvalGates:bundle.plan.approvalGates||[]});
    }
    staticReport=staticVerifier.verify(bundle);
    if(staticReport.status!=='STATIC_PREVIEW_READY'){
      state='POLICY_BLOCKED';
      return snapshot('STUDIO_SESSION_BLOCKED','REVISE_REQUEST',{reason:staticReport.reason,issues:staticReport.issues});
    }
    state='DRAFT_VERIFIED';
    return snapshot('STUDIO_DRAFT_READY','APPROVE_SANDBOX_WRITE',{projectSlug:staticReport.projectSlug,manifestHash:staticReport.manifestHash,files:staticReport.manifest.map(item=>item.path),approvalGates:bundle.plan.approvalGates});
  }

  async function createWorkspace(approval={}){
    if(state!=='DRAFT_VERIFIED')return snapshot('STUDIO_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'WORKSPACE_WRITE_OUT_OF_ORDER'});
    try{
      const authorization=sourceWriter.authorize(bundle,approval),written=await sourceWriter.persist(bundle,authorization);
      persistedReport=await diskVerifier.verify(staticReport);
      if(persistedReport.status!=='PERSISTED_WORKSPACE_VERIFIED'){
        state='INTEGRITY_BLOCKED';return snapshot('STUDIO_SESSION_BLOCKED','INSPECT_SANDBOX_INTEGRITY',{reason:persistedReport.reason});
      }
      state='WORKSPACE_VERIFIED';
      return snapshot('STUDIO_WORKSPACE_READY','APPROVE_SCRIPTLESS_PREVIEW_WRITE',{workspace:written.workspace,projectSlug:written.projectSlug,manifestHash:persistedReport.manifestHash,files:written.files});
    }catch(error){return snapshot('STUDIO_SESSION_BLOCKED','REVIEW_WRITE_APPROVAL',{reason:error&&error.message?error.message:'WORKSPACE_WRITE_FAILED'});}
  }

  async function createPreview(approval={}){
    if(state!=='WORKSPACE_VERIFIED')return snapshot('STUDIO_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'PREVIEW_WRITE_OUT_OF_ORDER'});
    previewPackage=await packager.packagePreview(persistedReport);
    if(previewPackage.status!=='SCRIPTLESS_PREVIEW_PACKAGE_READY'){
      state='PREVIEW_BLOCKED';return snapshot('STUDIO_SESSION_BLOCKED','INSPECT_PREVIEW_PACKAGE',{reason:previewPackage.reason});
    }
    try{
      const authorization=localPreviewWriter.authorize(previewPackage,approval),written=await localPreviewWriter.persist(previewPackage,authorization);
      state='LOCAL_PREVIEW_READY';
      return snapshot('STUDIO_LOCAL_PREVIEW_READY','USER_MAY_OPEN_LOCAL_INDEX',{preview:written.preview,projectSlug:written.projectSlug,manifestHash:written.manifestHash,files:written.files,opened:false,published:false});
    }catch(error){return snapshot('STUDIO_SESSION_BLOCKED','REVIEW_PREVIEW_APPROVAL',{reason:error&&error.message?error.message:'PREVIEW_WRITE_FAILED'});}
  }

  function status(){
    const actions={NEW:'SUBMIT_BRIEF',NEEDS_INPUT:'CREATE_NEW_SESSION_WITH_ANSWERS',POLICY_BLOCKED:'CREATE_NEW_SESSION_WITH_REVISED_REQUEST',DRAFT_VERIFIED:'APPROVE_SANDBOX_WRITE',INTEGRITY_BLOCKED:'INSPECT_SANDBOX_INTEGRITY',WORKSPACE_VERIFIED:'APPROVE_SCRIPTLESS_PREVIEW_WRITE',PREVIEW_BLOCKED:'INSPECT_PREVIEW_PACKAGE',LOCAL_PREVIEW_READY:'USER_MAY_OPEN_LOCAL_INDEX'};
    return snapshot('STUDIO_SESSION_STATUS',actions[state]||'STOP');
  }
  return freeze({VERSION,MODE,approvedBase,start,createWorkspace,createPreview,status});
}

module.exports=freeze({VERSION,MODE,create});

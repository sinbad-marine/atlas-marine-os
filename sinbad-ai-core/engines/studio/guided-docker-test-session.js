'use strict';
const path=require('node:path');
const persistedVerifier=require('./persisted-workspace-verifier.js');
const runnerModule=require('./docker-sandbox-test-runner.js');
const launcherModule=require('./node-docker-cli-launcher.js');
const evidenceWriterModule=require('./docker-test-evidence-writer.js');
const VERSION='0.4.2',MODE='GUIDED_VERIFIED_DOCKER_TEST_SESSION';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd())),workspaceRoot=path.join(approvedBase,'studio-workspaces');
  const launch=typeof options.launch==='function'?options.launch:launcherModule.create(options.launcherOptions).launch;
  const runner=runnerModule.create({approvedBase,clock:options.clock,launch,timeoutMs:options.timeoutMs,maxOutputBytes:options.maxOutputBytes});
  const evidenceWriter=evidenceWriterModule.create({approvedBase,clock:options.clock});
  let state='NEW',report=null,lastResult=null;
  const capabilities=freeze({inspectVerifiedTests:true,verifiedSoftwareTestExecution:true,persistTestEvidence:true,generalCommandExecution:false,shell:false,network:false,hostWrite:false,coreWrite:false,merge:false,publish:false});
  const snapshot=(status,nextAction,detail={})=>freeze({version:VERSION,mode:MODE,status,state,nextAction,...detail,capabilities});

  function prepare(inputReport){
    if(state!=='NEW')return snapshot('DOCKER_TEST_SESSION_BLOCKED','CREATE_NEW_SESSION',{reason:'SESSION_ALREADY_PREPARED'});
    const projectRoot=path.join(workspaceRoot,String(inputReport&&inputReport.projectSlug||''));
    if(!persistedVerifier.isReportFor(inputReport,projectRoot)){state='INPUT_BLOCKED';return snapshot('DOCKER_TEST_SESSION_BLOCKED','REVERIFY_STUDIO_WORKSPACE',{reason:'AUTHENTIC_PERSISTED_REPORT_REQUIRED'});}
    const tests=inputReport.files.filter(item=>/^software\/tests\/[A-Za-z0-9._-]+\.test\.js$/u.test(item.path)).map(item=>item.path).sort();
    if(!tests.length){state='INPUT_BLOCKED';return snapshot('DOCKER_TEST_SESSION_BLOCKED','CREATE_VERIFIED_SOFTWARE_TESTS',{reason:'VERIFIED_SOFTWARE_TEST_REQUIRED'});}
    report=inputReport;state='APPROVAL_REQUIRED';
    return snapshot('DOCKER_TEST_APPROVAL_REQUIRED','APPROVE_EXACT_VERIFIED_TEST_RUN',{projectSlug:report.projectSlug,manifestHash:report.manifestHash,image:runnerModule.IMAGE,tests,policy:{network:'NONE',rootFilesystem:'READ_ONLY',hostMount:'READ_ONLY',capabilities:'DROP_ALL',privilegeEscalation:'DENY',user:'65532:65532',memory:'256m',cpus:1,pids:64},approvalScope:'VERIFIED_SOFTWARE_TESTS_ONLY'});
  }

  async function runVerifiedTests(approval={}){
    if(state!=='APPROVAL_REQUIRED')return snapshot('DOCKER_TEST_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'TEST_RUN_OUT_OF_ORDER'});
    try{
      const result=await runner.run(report,runner.authorize(report,approval));lastResult=result;state=result.status==='SANDBOX_TESTS_PASSED'?'PASSED':'FAILED';
      return snapshot(result.status,'APPROVE_TEST_EVIDENCE_WRITE',{projectSlug:result.projectSlug,manifestHash:result.manifestHash,image:result.image,tests:result.tests,exitCode:result.exitCode,timedOut:result.timedOut,output:result.output,policy:result.policy,writes:result.writes,publishPerformed:false});
    }catch(error){state='BLOCKED';return snapshot('DOCKER_TEST_SESSION_BLOCKED','REVIEW_APPROVAL_RUNTIME_OR_WORKSPACE',{reason:error&&error.message?error.message:'SANDBOX_TEST_FAILED_CLOSED'});}
  }

  async function persistEvidence(approval={}){
    if(!['PASSED','FAILED'].includes(state))return snapshot('DOCKER_TEST_SESSION_BLOCKED','FOLLOW_CURRENT_NEXT_ACTION',{reason:'EVIDENCE_WRITE_OUT_OF_ORDER'});
    try{const saved=await evidenceWriter.persist(lastResult,evidenceWriter.authorize(lastResult,approval));state='EVIDENCE_PERSISTED';return snapshot('DOCKER_TEST_EVIDENCE_PERSISTED','REVIEW_PERSISTED_TEST_EVIDENCE',{evidence:saved.evidence,evidenceId:saved.evidenceId,receiptHash:saved.receiptHash,testStatus:saved.testStatus,sourceModified:false,published:false});}catch(error){return snapshot('DOCKER_TEST_SESSION_BLOCKED','REVIEW_EVIDENCE_WRITE_APPROVAL',{reason:error&&error.message?error.message:'TEST_EVIDENCE_WRITE_FAILED'});}
  }

  function status(){const actions={NEW:'SUBMIT_AUTHENTIC_PERSISTED_REPORT',INPUT_BLOCKED:'CREATE_NEW_SESSION_AFTER_REVERIFICATION',APPROVAL_REQUIRED:'APPROVE_EXACT_VERIFIED_TEST_RUN',PASSED:'APPROVE_TEST_EVIDENCE_WRITE',FAILED:'APPROVE_TEST_EVIDENCE_WRITE',EVIDENCE_PERSISTED:'REVIEW_PERSISTED_TEST_EVIDENCE',BLOCKED:'CREATE_NEW_SESSION_AFTER_REVIEW'};return snapshot('DOCKER_TEST_SESSION_STATUS',actions[state]||'STOP');}
  return freeze({VERSION,MODE,approvedBase,prepare,runVerifiedTests,persistEvidence,status});
}
module.exports=freeze({VERSION,MODE,create});

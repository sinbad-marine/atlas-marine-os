(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contract:load('./grounded-orchestration-contract.js')||root.SinbadGroundedOrchestrationContract,
    audit:load('./audit-log.js')||root.SinbadAuditLog,
    claimPlanner:load('../verification/claim-planner.js')||root.SinbadClaimPlanner,
    coverageGate:load('../verification/query-coverage-gate.js')||root.SinbadQueryCoverageGate
  });
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundedOrchestrator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  const UPSTREAM_STOPS=new Set(['INVALID_INPUT','LOW_CONFIDENCE','SAFETY_BLOCKED','ROUTING_BLOCKED','PIPELINE_ERROR']);
  function create(options={}){
    const decision=options.decisionPipeline;
    const retrieval=options.retrievalEngine;
    const grounding=options.groundingPipeline;
    const planner=options.claimPlanner||deps.claimPlanner;
    if(!decision||typeof decision.run!=='function')throw new TypeError('Phase 1 decision pipeline is required');
    if(!retrieval||typeof retrieval.run!=='function')throw new TypeError('Phase 2A retrieval engine is required');
    if(!grounding||typeof grounding.run!=='function')throw new TypeError('Phase 2B grounding pipeline is required');
    const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
    const now=typeof options.now==='function'?options.now:()=>new Date().toISOString();

    function phaseForStage(stage){
      if(stage==='retrieval'||stage==='evidence-evaluation')return '2A';
      if(['grounded-synthesis','citation-provenance','grounded-confidence'].includes(stage))return '2B';
      if(stage==='claim-verification')return '2E';if(stage==='claim-planning')return '2F';
      if(stage==='query-coverage')return '2G';if(stage==='answer-composition')return '2H';
      if(stage==='answer-citation-map')return '2I';if(stage==='answer-citation-verification')return '2J';
      return 'UNKNOWN';
    }

    function linkedAudit(transactionId,phase1Entries,sharedEntries){
      return Object.freeze([
        ...phase1Entries.map(entry=>Object.freeze({...entry,transactionId,phase:'1'})),
        ...sharedEntries.map(entry=>Object.freeze({...entry,transactionId,phase:phaseForStage(entry.stage)}))
      ]);
    }
    function finish(input){return deps.contract.result(input);}
    function run(input={}){
      const totalStarted=clock();
      const transactionId=String(input.transactionId||input.id||'').trim();
      if(!transactionId){
        return finish({transactionId:'',status:'INVALID_INPUT',warnings:['A deterministic transactionId or request id is required.'],metrics:{totalDurationMs:Math.max(0,clock()-totalStarted)}});
      }
      const phase1Started=clock();
      const phase1=decision.run({...input,evidence:[]});
      const phase1DurationMs=Math.max(0,clock()-phase1Started);
      const contextEntry=Array.isArray(phase1.audit)?phase1.audit.find(entry=>entry.stage==='context'):null;
      if(UPSTREAM_STOPS.has(phase1.status)){
        return finish({
          transactionId,status:phase1.status,intent:phase1.analysis,safety:phase1.safety,
          context:contextEntry?.details||null,routing:phase1.routing,
          retrieval:{required:false,status:null},evidence:{status:null},groundedAnswer:null,
          confidence:null,warnings:[phase1.error?.message||phase1.status],
          audit:linkedAudit(transactionId,phase1.audit||[],[]),
          metrics:{phase1DurationMs,phase2aDurationMs:0,phase2bDurationMs:0,totalDurationMs:Math.max(0,clock()-totalStarted)}
        });
      }
      const retrievalRequired=phase1.status==='SOURCE_INSUFFICIENT';
      if(!retrievalRequired){
        return finish({
          transactionId,status:'PLAN_ONLY_READY',intent:phase1.analysis,safety:phase1.safety,
          context:contextEntry?.details||null,routing:phase1.routing,
          retrieval:{required:false,status:null},evidence:{status:null},groundedAnswer:null,
          confidence:null,warnings:['No evidence-grounded factual answer was requested by the current plan.'],
          audit:linkedAudit(transactionId,phase1.audit||[],[]),
          metrics:{phase1DurationMs,phase2aDurationMs:0,phase2bDurationMs:0,totalDurationMs:Math.max(0,clock()-totalStarted)}
        });
      }

      const sharedAudit=deps.audit.create({now});
      const phase2aStarted=clock();
      const retrievalResult=retrieval.run({
        id:transactionId,query:phase1.request.question,language:phase1.request.language,
        requireAuthoritative:true,safetyCritical:['high','critical'].includes(phase1.safety?.risk),
        limit:input.retrieval?.limit,filters:input.retrieval?.filters,minimumRelevance:input.retrieval?.minimumRelevance
      },{audit:sharedAudit});
      const phase2aDurationMs=Math.max(0,clock()-phase2aStarted);

      const phase2bStarted=clock();
      const suppliedClaims=Array.isArray(input.claims)?input.claims:[];
      const selectedEvidence=retrievalResult.evaluation?.selected||[];let claimPlan=null;
      const plannedQueryHash=deps.claimPlanner.queryHash(phase1.request.question);
      if(!suppliedClaims.length){try{claimPlan=planner&&typeof planner.plan==='function'?planner.plan({transactionId,query:phase1.request.question,selected:selectedEvidence,limit:input.claimPlanning?.limit},{audit:sharedAudit}):deps.claimPlanner.unavailable({transactionId,queryHash:plannedQueryHash,selectedEvidenceCount:selectedEvidence.length});}catch(error){sharedAudit.append('claim-planning','evidence-bound-claim-planner','stopped','CLAIM_PLANNER_FAILURE',{reasonCode:error?.code||'INTERNAL_ERROR'});claimPlan=deps.claimPlanner.unavailable({transactionId,queryHash:plannedQueryHash,selectedEvidenceCount:selectedEvidence.length,reasonCode:error?.code||'INTERNAL_ERROR'});}}
      const plannedClaims=Array.isArray(claimPlan?.claims)?claimPlan.claims:[];
      const claimCoverage=!suppliedClaims.length&&claimPlan?.status==='CLAIMS_PLANNED'?deps.coverageGate.evaluate({transactionId,query:phase1.request.question,claimPlan},{audit:sharedAudit}):null;
      const grounded=grounding.run({transactionId,retrievalResult,claims:suppliedClaims.length?suppliedClaims:plannedClaims,claimPlan,claimCoverage,planningQuery:phase1.request.question},{audit:sharedAudit});
      const phase2bDurationMs=Math.max(0,clock()-phase2bStarted);
      const status=grounded.status==='GROUNDED'?'GROUNDED_PLAN_READY':grounded.status;
      const selected=retrievalResult.evaluation?.selected?.map(item=>item.id)||[];
      const rejected=[
        ...(retrievalResult.evaluation?.rejected||[]).map(entry=>({id:entry.item?.id||null,reason:entry.reason})),
        ...(retrievalResult.rejected||[]).map(entry=>({id:entry.id||null,adapterId:entry.adapterId||null,reason:entry.reason}))
      ];
      return finish({
        transactionId,status,intent:phase1.analysis,safety:phase1.safety,
        context:contextEntry?.details||null,routing:phase1.routing,
        retrieval:{required:true,status:retrievalResult.status,metrics:retrievalResult.metrics},
        evidence:{status:retrievalResult.status,selected,rejected},
        groundedAnswer:grounded,claimPlan,claimCoverage,citations:grounded.citations,provenance:grounded.provenance,
        confidence:grounded.confidence,warnings:grounded.warnings,
        audit:linkedAudit(transactionId,phase1.audit||[],sharedAudit.snapshot()),
        metrics:{phase1DurationMs,phase2aDurationMs,phase2bDurationMs,totalDurationMs:Math.max(0,clock()-totalStarted)}
      });
    }
    return Object.freeze({run});
  }
  return {create};
});

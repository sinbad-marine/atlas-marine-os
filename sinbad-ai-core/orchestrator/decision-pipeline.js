(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contracts:load('../contracts.js')||root.SinbadAiCoreContracts,
    intent:load('../intent-engine.js')||root.SinbadIntentEngine,
    safety:load('../safety-engine.js')||root.SinbadSafetyEngine,
    boundary:load('../memory/evidence-boundary.js')||root.SinbadMemoryEvidenceBoundary,
    audit:load('./audit-log.js')||root.SinbadAuditLog,
    routerContract:load('../experts/expert-router.js')||root.SinbadExpertRouter
  });
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadDecisionPipeline=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  const RETRIEVAL_INTENTS=new Set(['passage','publication','document']);
  function validRoutingPlan(routing){
    return Boolean(deps.routerContract&&typeof deps.routerContract.isTrustedPlan==='function'&&deps.routerContract.isTrustedPlan(routing)&&Object.isFrozen(routing)&&routing.planVersion==='sinbad-expert-route-plan/2-v1'&&routing.routable===false&&typeof routing.planningRoutable==='boolean'&&routing.executionAllowed===false&&Array.isArray(routing.routes)&&Object.isFrozen(routing.routes)&&routing.routes.every(route=>route&&Object.isFrozen(route)&&typeof route.expertId==='string'&&!Object.values(route).some(value=>typeof value==='function'))&&Array.isArray(routing.gaps)&&Object.isFrozen(routing.gaps)&&routing.gaps.every(gap=>gap&&Object.isFrozen(gap)&&typeof gap.reason==='string'&&!Object.values(gap).some(value=>typeof value==='function'))&&Array.isArray(routing.executionBlockedReasons)&&Object.isFrozen(routing.executionBlockedReasons)&&routing.executionBlockedReasons.length>0&&routing.executionBlockedReasons.at(-1)==='ENGINE_PORT_GATE_REQUIRED'&&routing.executionBlockedReason===routing.executionBlockedReasons[0]);
  }
  function create(options={}){
    const router=options.router;
    if(!router||typeof router.plan!=='function')throw new TypeError('expert router is required');
    const memory=options.memory||null;
    const now=typeof options.now==='function'?options.now:()=>new Date().toISOString();

    function final(status,request,analysis,safety,routing,evidence,permission,audit,error=null){
      return Object.freeze({
        version:'sinbad-decision-pipeline/2',status,request,analysis,safety,routing,evidence,permission,
        error:error?Object.freeze({...error}):null,audit:audit.snapshot(),
        integration:Object.freeze({expertExecutionPrepared:false,expertExecutionPerformed:false})
      });
    }
    function stoppedPermission(reason){return Object.freeze({allowed:false,reason:String(reason),mode:'STOP'});}
    function planPermission(){return Object.freeze({allowed:true,reason:'ALL_GATES_PASSED',mode:'PLAN_ONLY'});}

    function run(input={}){
      const audit=deps.audit.create({now});
      try{
        const request=deps.contracts.request(input);
        if(!request.question){
          audit.append('input','contracts','stopped','EMPTY_QUESTION');
          return final('INVALID_INPUT',request,null,null,null,null,stoppedPermission('EMPTY_QUESTION'),audit,{code:'EMPTY_QUESTION',message:'A non-empty question is required.'});
        }
        audit.append('input','contracts','passed','REQUEST_NORMALIZED',{requestId:request.id||null,language:request.language});

        const analysis=deps.intent.analyze(request.question);
        audit.append('intent','intent-engine',analysis.confidence>=0.6?'passed':'stopped',analysis.intent,{intent:analysis.intent,confidence:analysis.confidence,secondaryIntents:analysis.secondaryIntents});
        if(analysis.confidence<0.6){
          return final('LOW_CONFIDENCE',request,analysis,null,null,null,stoppedPermission('LOW_CONFIDENCE'),audit,{code:'LOW_CONFIDENCE',message:'Intent confidence is insufficient; clarification is required.'});
        }

        const safety=deps.safety.assess(analysis);
        audit.append('safety','safety-engine',safety.blockedFromAutonomousAction?'stopped':'passed',safety.risk,{risk:safety.risk,gates:safety.gates.map(g=>g.code)});
        if(safety.blockedFromAutonomousAction){
          return final('SAFETY_BLOCKED',request,analysis,safety,null,null,stoppedPermission('SAFETY_BLOCKED'),audit,{code:'SAFETY_BLOCKED',message:'Safety policy blocks autonomous execution.'});
        }

        const memorySnapshot=memory&&typeof memory.snapshot==='function'?memory.snapshot():Object.freeze({session:[],persistent:[],operational:[],preferences:[]});
        audit.append('context','memory-manager','passed','CONTEXT_PARTITIONED',{session:memorySnapshot.session.length,persistent:memorySnapshot.persistent.length,operational:memorySnapshot.operational.length,preferences:memorySnapshot.preferences.length});

        const routing=router.plan({analysis,safety,context:{...request.context,memory:memorySnapshot},requiredIntents:input.requiredIntents});
        if(!validRoutingPlan(routing)){
          audit.append('routing','expert-router','stopped','ROUTING_CONTRACT_REJECTED',{planVersion:routing.planVersion||null});
          return final('ROUTING_BLOCKED',request,analysis,safety,null,null,stoppedPermission('ROUTING_CONTRACT_REJECTED'),audit,{code:'ROUTING_CONTRACT_REJECTED',message:'Unknown or execution-capable routing contracts are rejected.'});
        }
        audit.append('routing','expert-router',routing.gaps.length?'stopped':'planned',routing.gaps.length?routing.gaps.map(g=>g.reason).join(','):'EXPERT_PLAN_ONLY',{routes:routing.routes.map(r=>r.expertId),gaps:routing.gaps});
        if(!routing.routes.length||routing.gaps.length){
          const code=routing.gaps[0]?.reason||'EXPERT_NOT_AVAILABLE';
          return final('ROUTING_BLOCKED',request,analysis,safety,routing,null,stoppedPermission(code),audit,{code,message:'Required expertise is unavailable or below confidence threshold.'});
        }

        const rawEvidence=Array.isArray(input.evidence)?input.evidence:[];
        const evidence=deps.boundary.partition(rawEvidence);
        const retrievalRequired=safety.needsLiveData||RETRIEVAL_INTENTS.has(analysis.intent)||routing.routes.some(route=>route.requiresVerifiedSources);
        const evidenceAdequate=!retrievalRequired||evidence.verified.length>0;
        audit.append('evidence','evidence-boundary',evidenceAdequate?'passed':'stopped',retrievalRequired?'VERIFIED_SOURCE_REQUIRED':'NO_RETRIEVAL_REQUIRED',{retrievalRequired,verified:evidence.verified.length,memory:evidence.memory.length,advisory:evidence.advisory.length});
        if(!evidenceAdequate){
          return final('SOURCE_INSUFFICIENT',request,analysis,safety,routing,evidence,stoppedPermission('SOURCE_INSUFFICIENT'),audit,{code:'SOURCE_INSUFFICIENT',message:'Verified authoritative evidence is required before expert execution.'});
        }

        const permission=planPermission();
        audit.append('permission','decision-pipeline','passed','PLAN_GATES_PASSED',{mode:permission.mode});
        audit.append('result','result-contract','ready','PLAN_ONLY_READY',{executionPerformed:false});
        return final('PLAN_ONLY_READY',request,analysis,safety,routing,evidence,permission,audit);
      }catch(error){
        audit.append('error','decision-pipeline','stopped','PIPELINE_ERROR',{name:error?.name||'Error'});
        return final('PIPELINE_ERROR',null,null,null,null,null,stoppedPermission('PIPELINE_ERROR'),audit,{code:'PIPELINE_ERROR',message:String(error?.message||error)});
      }
    }
    return Object.freeze({run});
  }
  return {create};
});


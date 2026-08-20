(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadNavigationEngineAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const OPERATIONS=Object.freeze([
    'inverseRoute','directRoute','calculateRoutePlan','calculateDistanceRun',
    'assessInputProvenance','assessInputSet','assessPositionConsensus',
    'verifyInverseAgainstReference','verifyDirectInverseClosure',
    'createRouteRevision','verifyRouteRevision','verifyRevisionChain','assessRouteRelease'
  ]);
  const REQUIRED_ENGINE_API=Object.freeze([...OPERATIONS,'EARTH_MODELS','SOURCE_TYPES','quantities']);
  const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

  function freeze(value){
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      for(const child of Object.values(value))freeze(child);
      Object.freeze(value);
    }
    return value;
  }
  function text(value,name){
    const result=String(value||'').trim();
    if(!result)throw new TypeError(`${name} is required`);
    return result;
  }
  function authorization(input,clock){
    if(!input||typeof input!=='object'||Array.isArray(input))return {allowed:false,reason:'AUTHORIZATION_REQUIRED'};
    if(input.mode!=='AUTHORIZED_EXECUTION'||input.allowed!==true)return {allowed:false,reason:'AUTHORIZATION_REQUIRED'};
    const authorizationId=text(input.authorizationId,'authorizationId');
    const approvedBy=text(input.approvedBy,'approvedBy');
    if(!ID.test(authorizationId)||!ID.test(approvedBy))throw new TypeError('authorization identities are malformed');
    const expiresAt=new Date(input.expiresAt);
    if(Number.isNaN(expiresAt.getTime()))throw new TypeError('expiresAt must be a valid timestamp');
    if(expiresAt.getTime()<=clock())return {allowed:false,reason:'AUTHORIZATION_EXPIRED'};
    const operations=[...new Set((Array.isArray(input.operations)?input.operations:[]).map(String))];
    if(!operations.length||operations.some(item=>!OPERATIONS.includes(item)))throw new RangeError('authorization operations are empty or unsupported');
    return {allowed:true,authorizationId,approvedBy,expiresAt:expiresAt.toISOString(),operations:Object.freeze(operations)};
  }
  function blocked(operation,reason){
    return freeze({
      status:'EXECUTION_BLOCKED',operation:operation||null,reason,
      security:{corePlanOnlyPreserved:true,navigationExecutionPerformed:false},
      warnings:['Navigation engine remains decision support and is not an approved sole source for vessel operations']
    });
  }
  function validateEngine(engine){
    if(!engine||typeof engine!=='object')throw new TypeError('navigation engine loader returned an invalid engine');
    const missing=REQUIRED_ENGINE_API.filter(name=>!(name in engine));
    if(missing.length)throw new TypeError(`navigation engine API incomplete: ${missing.join(', ')}`);
    for(const operation of OPERATIONS)if(typeof engine[operation]!=='function')throw new TypeError(`navigation operation is not callable: ${operation}`);
    return engine;
  }
  function descriptor(){
    return freeze({
      id:'navigation-engine',name:'Sinbad Navigation Engine',version:'0.2.0',
      intents:['navigation','passage'],
      capabilities:[...OPERATIONS],priority:90,minConfidence:0.8,
      requiresVerifiedSources:true,supportsMultiExpert:true,
      executionPolicy:'EXPLICIT_AUTHORIZATION_ONLY'
    });
  }
  function create(options={}){
    if(typeof options.engineLoader!=='function')throw new TypeError('engineLoader is required');
    const clock=typeof options.clock==='function'?options.clock:Date.now;
    const auth=authorization(options.authorization,clock);
    function status(){return freeze({
      installed:true,executionAllowed:auth.allowed,
      reason:auth.allowed?'EXPLICIT_AUTHORIZATION_VALID':auth.reason,
      descriptor:descriptor(),
      security:{corePlanOnlyPreserved:true,automaticOrchestratorExecution:false}
    });}
    function execute(operation,payload){
      const name=String(operation||'');
      if(!OPERATIONS.includes(name))return blocked(name,'OPERATION_NOT_ALLOWED');
      if(!auth.allowed)return blocked(name,auth.reason);
      if(new Date(auth.expiresAt).getTime()<=clock())return blocked(name,'AUTHORIZATION_EXPIRED');
      if(!auth.operations.includes(name))return blocked(name,'OPERATION_NOT_AUTHORIZED');
      const engine=validateEngine(options.engineLoader());
      const args=Array.isArray(payload)?payload:[payload];
      const result=engine[name](...args);
      return freeze({
        status:'EXECUTED',operation:name,result,
        authorization:{authorizationId:auth.authorizationId,approvedBy:auth.approvedBy,expiresAt:auth.expiresAt},
        security:{corePlanOnlyPreserved:true,navigationExecutionPerformed:true,automaticOrchestratorExecution:false},
        warnings:['Execution was explicitly authorized outside the PLAN_ONLY orchestrator','Result remains subject to onboard verification and human authority']
      });
    }
    return Object.freeze({descriptor:descriptor(),status,execute});
  }
  return Object.freeze({OPERATIONS,descriptor,create});
});

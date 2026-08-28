(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SinbadExamIntelligence=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MODES=new Set(['LOCAL_SYNTHETIC','CONTROLLED_RELEASE']),LOOPBACK=new Set(['127.0.0.1','localhost','[::1]']),freeze=value=>Object.freeze(value);
  function normalize(config={},options={}){
    if(config.schemaVersion!=='1.0.0')throw new Error('EXAM_INTEGRATION_SCHEMA_INVALID');
    if(!MODES.has(config.integrationMode))throw new Error('EXAM_INTEGRATION_MODE_INVALID');
    let appUrl;try{appUrl=new URL(config.appUrl,options.baseUrl||'http://localhost/');}catch{throw new Error('EXAM_INTEGRATION_URL_INVALID');}
    if(!['http:','https:'].includes(appUrl.protocol))throw new Error('EXAM_INTEGRATION_PROTOCOL_INVALID');
    if(config.integrationMode==='LOCAL_SYNTHETIC'){
      if(!LOOPBACK.has(appUrl.hostname))throw new Error('LOCAL_EXAM_INTEGRATION_REQUIRES_LOOPBACK');
      if(config.releaseAuthorized===true)throw new Error('SYNTHETIC_MODE_CANNOT_AUTHORIZE_RELEASE');
    }
    if(config.integrationMode==='CONTROLLED_RELEASE'){
      if(appUrl.protocol!=='https:')throw new Error('CONTROLLED_RELEASE_REQUIRES_HTTPS');
      if(config.releaseAuthorized!==true)throw new Error('CONTROLLED_RELEASE_AUTHORIZATION_REQUIRED');
    }
    if(config.learnerContextTransport!=='AUTHENTICATED_BACKCHANNEL_ONLY')throw new Error('LEARNER_CONTEXT_TRANSPORT_INVALID');
    return freeze({schemaVersion:'1.0.0',integrationMode:config.integrationMode,appUrl:appUrl.href,appOrigin:appUrl.origin,releaseAuthorized:config.releaseAuthorized===true,learnerContextTransport:config.learnerContextTransport});
  }
  function create(config,options={}){
    const normalized=normalize(config,options),openWindow=options.openWindow;
    let runtimeUrl;try{runtimeUrl=new URL(options.baseUrl||'http://localhost/');}catch{runtimeUrl=new URL('http://localhost/');}
    const usesHostedFallback=normalized.integrationMode==='LOCAL_SYNTHETIC'&&!LOOPBACK.has(runtimeUrl.hostname);
    const launchUrl=usesHostedFallback?new URL('./exam-intelligence-local-required.html',runtimeUrl).href:normalized.appUrl;
    function publicStatus(){return freeze({configured:true,mode:normalized.integrationMode,releaseAuthorized:normalized.releaseAuthorized,studentReleaseBlocked:!normalized.releaseAuthorized,legacyAcademyQuestionsTrusted:false,learnerContextTransport:normalized.learnerContextTransport});}
    function launch(){if(typeof openWindow!=='function')throw new Error('EXAM_WINDOW_OPENER_REQUIRED');const child=openWindow(launchUrl,'sinbadExamIntelligence','popup=yes,resizable=yes,scrollbars=yes,width=1440,height=920');if(!child)throw new Error('EXAM_WINDOW_BLOCKED');return freeze({opened:true,mode:normalized.integrationMode,releaseAuthorized:normalized.releaseAuthorized,safeFallback:usesHostedFallback});}
    function handshake(target){if(!target||typeof target.postMessage!=='function')throw new Error('EXAM_TARGET_WINDOW_REQUIRED');target.postMessage(freeze({version:1,type:'SINBAD_ACADEMY_HOST_READY',capabilities:freeze(['LAUNCH','STATUS']),learnerContext:null}),normalized.appOrigin);return true;}
    function acceptsMessage(event){return Boolean(event&&event.origin===normalized.appOrigin&&event.data?.version===1&&event.data?.type==='SINBAD_EXAM_INTELLIGENCE_READY');}
    return freeze({config:normalized,publicStatus,launch,handshake,acceptsMessage});
  }
  return freeze({normalize,create});
});

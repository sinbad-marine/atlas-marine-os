(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadAiCoreManifest=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const manifest=Object.freeze({
    name:'Sinbad AI Core',
    phase:1,
    contractVersion:'1.0.0',
    layers:Object.freeze(['intent','safety','context','orchestrator']),
    boundaries:Object.freeze(['application','experts','memory','providers']),
    domainLogicPolicy:'external-experts-only'
  });
  return manifest;
});


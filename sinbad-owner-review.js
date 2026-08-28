(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SinbadOwnerReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LOOPBACK=new Set(['127.0.0.1','localhost','[::1]']),freeze=value=>Object.freeze(value);
  function create(config={},options={}){
    let appUrl,runtimeUrl;
    try{appUrl=new URL(config.appUrl);}catch{throw new Error('OWNER_REVIEW_URL_INVALID');}
    if(appUrl.protocol!=='http:'||!LOOPBACK.has(appUrl.hostname))throw new Error('OWNER_REVIEW_REQUIRES_LOOPBACK');
    try{runtimeUrl=new URL(options.baseUrl||'http://localhost/');}catch{runtimeUrl=new URL('http://localhost/');}
    const safeFallback=!LOOPBACK.has(runtimeUrl.hostname);
    const launchUrl=safeFallback?new URL('./owner-review-local-required.html',runtimeUrl).href:appUrl.href;
    function launch(){
      if(typeof options.openWindow!=='function')throw new Error('OWNER_REVIEW_WINDOW_OPENER_REQUIRED');
      const child=options.openWindow(launchUrl,'sinbadOwnerQuestionReview','popup=yes,resizable=yes,scrollbars=yes,width=1500,height=940');
      if(!child)throw new Error('OWNER_REVIEW_WINDOW_BLOCKED');
      return freeze({opened:true,safeFallback});
    }
    return freeze({launch});
  }
  return freeze({create});
});

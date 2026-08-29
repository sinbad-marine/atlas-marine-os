(function(root){
  let examPort=4192;
  try{
    const current=new URL(root.location.href),requested=Number(current.searchParams.get('examPort'));
    if(['127.0.0.1','localhost','[::1]'].includes(current.hostname)&&Number.isInteger(requested)&&requested>=1024&&requested<=65535)examPort=requested;
  }catch{}
  root.SINBAD_EXAM_INTELLIGENCE_CONFIG=Object.freeze({schemaVersion:'1.0.0',integrationMode:'LOCAL_SYNTHETIC',appUrl:`http://127.0.0.1:${examPort}/`,releaseAuthorized:false,learnerContextTransport:'AUTHENTICATED_BACKCHANNEL_ONLY'});
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadInstalledNavigationEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const PACKAGE_PATH='../engines/navigation';
  function metadata(){
    const manifest=require(`${PACKAGE_PATH}/package.json`);
    return Object.freeze({
      id:'sinbad-navigation-engine',
      version:manifest.version,
      contract:'core-navigation-engine-loader/1.0.0',
      executionMode:'EXPLICIT_AUTHORIZATION_ONLY',
      operationalApproval:false
    });
  }
  function load(){return require(PACKAGE_PATH);}
  return Object.freeze({metadata,load});
});

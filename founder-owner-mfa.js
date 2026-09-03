(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SinbadFounderMfa=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function requireClient(client){if(!client?.auth?.mfa)throw new Error('SUPABASE_MFA_CLIENT_REQUIRED');return client}
  function create(client){
    requireClient(client);
    return Object.freeze({
      async status(){
        const [{data:factors,error:factorsError},{data:aal,error:aalError}]=await Promise.all([client.auth.mfa.listFactors(),client.auth.mfa.getAuthenticatorAssuranceLevel()]);
        if(factorsError)throw factorsError;if(aalError)throw aalError;
        return {aal:aal.currentLevel,nextAal:aal.nextLevel,totp:(factors.totp||[]).map(factor=>({id:factor.id,status:factor.status,friendlyName:factor.friendly_name}))};
      },
      async enrollTotp(friendlyName='Sinbad Founder Authenticator'){
        const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName});if(error)throw error;
        return {factorId:data.id,qrCode:data.totp.qr_code,secret:data.totp.secret,uri:data.totp.uri};
      },
      async challengeTotp(factorId,code){
        if(!factorId||!/^[0-9]{6}$/.test(String(code)))throw new Error('VALID_TOTP_CODE_REQUIRED');
        const {data,error}=await client.auth.mfa.challengeAndVerify({factorId,code:String(code)});if(error)throw error;return data;
      },
      async unenroll(factorId){const {data,error}=await client.auth.mfa.unenroll({factorId});if(error)throw error;return data;},
      async issueStepUp(descriptor){
        const {data,error}=await client.functions.invoke('founder-owner-step-up',{body:descriptor});if(error)throw error;return data;
      }
    });
  }
  return Object.freeze({create});
});

(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SinbadOwnerUi=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  let active=false;
  function create(client){
    if(!root.SinbadFounderMfa)throw new Error('OWNER_MFA_MODULE_REQUIRED');
    const mfa=root.SinbadFounderMfa.create(client);
    async function verify(summary='Protect your Sinbad account',alwaysShow=false){
      const state=await mfa.status();
      if(state.aal==='aal2'&&!alwaysShow)return;
      if(active)throw new Error('OWNER_VERIFICATION_ALREADY_OPEN');
      active=true;
      try{
        await new Promise((resolve,reject)=>{
          const doc=root.document,dialog=doc.createElement('dialog');
          dialog.className='auth-dialog';dialog.setAttribute('aria-labelledby','ownerVerificationTitle');
          const card=doc.createElement('form');card.className='auth-card';
          const title=doc.createElement('h2');title.id='ownerVerificationTitle';title.textContent='Owner verification';
          const detail=doc.createElement('p');detail.textContent=summary;
          const status=doc.createElement('p');status.setAttribute('role','status');
          const setup=doc.createElement('div');
          const label=doc.createElement('label');label.textContent='Authenticator code';
          const input=doc.createElement('input');input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.required=true;
          label.append(input);
          const enable=doc.createElement('button');enable.type='button';enable.className='btn';enable.textContent='Set up Authenticator';
          const submit=doc.createElement('button');submit.type='submit';submit.className='btn primary';submit.textContent='Verify';
          const cancel=doc.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancel';
          let factor=state.totp.find(item=>item.status==='verified')?.id,created=null,verified=false,closed=false,busy=false;
          label.hidden=!factor;submit.hidden=!factor;enable.hidden=Boolean(factor);
          if(state.aal==='aal2'){
            status.textContent='Authenticator verification is active for this session.';
            label.hidden=true;submit.hidden=true;enable.hidden=true;cancel.textContent='Close';
          }else status.textContent=factor?'Enter the six-digit code from your Authenticator.':'Set up an Authenticator to protect sensitive operations.';
          const finish=(ok)=>{
            if(closed)return;closed=true;input.value='';setup.replaceChildren();dialog.close();dialog.remove();
            if(created&&!verified&&!busy)mfa.unenroll(created).catch(()=>{});
            if(ok||alwaysShow)resolve();else reject(new Error('OWNER_VERIFICATION_CANCELLED'));
          };
          cancel.addEventListener('click',()=>finish(false));
          dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
          enable.addEventListener('click',async()=>{
            if(busy)return;busy=true;enable.disabled=true;status.textContent='Preparing Authenticator setup…';
            try{
              const enrollment=await mfa.enrollTotp();created=enrollment.factorId;
              if(closed){await mfa.unenroll(created).catch(()=>{});return;}
              factor=created;
              const instructions=doc.createElement('p');instructions.textContent='Add this setup key to your Authenticator, then enter its six-digit code. Keep the key private.';
              const key=doc.createElement('code');key.textContent=enrollment.secret;
              setup.replaceChildren(instructions,key);label.hidden=false;submit.hidden=false;enable.hidden=true;
              status.textContent='The setup key is shown only in this dialog.';input.focus();
            }catch(error){if(!closed){status.textContent=error.message||'Authenticator setup failed.';enable.disabled=false;}}
            finally{busy=false;}
          });
          card.addEventListener('submit',async event=>{
            event.preventDefault();if(busy||!factor||closed)return;
            if(!/^[0-9]{6}$/.test(input.value)){status.textContent='Enter a six-digit code.';return;}
            busy=true;submit.disabled=true;
            try{
              await mfa.challengeTotp(factor,input.value);verified=true;
              if(!closed)finish(true);
            }catch(error){if(!closed){status.textContent=error.message||'Verification failed.';input.value='';submit.disabled=false;input.focus();}else if(created&&!verified){mfa.unenroll(created).catch(()=>{});}}
            finally{busy=false;}
          });
          card.append(title,detail,status,setup,label,enable,submit,cancel);dialog.append(card);doc.body.append(dialog);dialog.showModal();
          (factor&&state.aal!=='aal2'?input:cancel).focus();
        });
      }finally{active=false;}
    }
    return Object.freeze({
      manage:()=>verify('Account security',true),
      async authorize(descriptor,summary){
        // Snapshot before the interactive step; later UI changes cannot alter
        // the command that is sent to the trusted issuer.
        const exact=JSON.parse(JSON.stringify(descriptor));
        await verify(summary);
        const proof=await mfa.issueStepUp(exact);
        if(!proof?.authorizationId||!/^[0-9a-f]{64}$/.test(proof.nonce||'')||!Number.isFinite(Date.parse(proof.expiresAt)))throw new Error('OWNER_APPROVAL_INVALID');
        return proof;
      }
    });
  }
  return Object.freeze({create});
});

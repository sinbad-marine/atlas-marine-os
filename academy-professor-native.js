'use strict';
(function(){
  const bridge=document.getElementById('phaseOneClassroom');
  if(bridge){Object.defineProperty(bridge,'contentDocument',{configurable:true,get:()=>document});Object.defineProperty(bridge,'contentWindow',{configurable:true,get:()=>window})}
  function normalizeTurkishSpeech(text){return String(text||'').replace(/\b\d{1,3}(?:\.\d{3})+\b/g,value=>value.replaceAll('.',''))}
  const NativeUtterance=window.SpeechSynthesisUtterance;
  if(NativeUtterance){const WrappedUtterance=function(text){return new NativeUtterance(normalizeTurkishSpeech(text))};WrappedUtterance.prototype=NativeUtterance.prototype;Object.setPrototypeOf(WrappedUtterance,NativeUtterance);window.SpeechSynthesisUtterance=WrappedUtterance}
  const byId=id=>document.getElementById(id);
  function setMenu(open){const drawer=byId('professorMenu'),backdrop=byId('nativeMenuBackdrop'),button=byId('openProfessorMenu');drawer.classList.toggle('open',open);drawer.setAttribute('aria-hidden',String(!open));button.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;if(open)byId('closeProfessorMenu').focus();else button.focus()}
  function boardText(text){const clean=String(text||'').replace(/\[S\d+\]/g,'').replace(/\s+/g,' ').trim();const sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[];return sentences.slice(0,4).join(' ').slice(0,620)}
  function updateBoard(){const board=byId('professorBlackboard'),target=byId('professorBlackboardText');if(board.dataset.owner!=='auto')return;const answers=[...document.querySelectorAll('#academyMessages .academy-message.sinbad p')];const text=boardText(answers.at(-1)?.textContent);if(text)target.textContent=text}
  function shortenLegacyWelcome(){const first=byId('academyMessages')?.querySelector('.academy-message.sinbad p');if(first&&/^Welcome aboard\./i.test(first.textContent||''))first.textContent='Hazırım Kaptan. Ne öğrenmek istersiniz?'}
  function learnerAddress(){const voice=window.SinbadSpeakerIdentity?.address?.();if(voice)return voice;const title=localStorage.getItem('sinbad_learner_title')||'',name=byId('learnerName')?.value?.trim()||'Öğrenci';return title&&title.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')?name:[title,name].filter(Boolean).join(' ')}
  function updateSpeakerLabels(){const label=learnerAddress()||'Öğrenci';document.querySelectorAll('#academyMessages .academy-message.user strong').forEach(node=>{if(node.textContent!==label)node.textContent=label})}
  window.SinbadProfessorBoard={claimForAnimation(){byId('professorBlackboard').dataset.owner='animation'},releaseToLesson(){byId('professorBlackboard').dataset.owner='auto';updateBoard()},write(text){byId('professorBlackboardText').textContent=String(text||'').slice(0,900)}};
  window.addEventListener('load',()=>{
    byId('openProfessorMenu').addEventListener('click',()=>setMenu(true));byId('closeProfessorMenu').addEventListener('click',()=>setMenu(false));byId('nativeMenuBackdrop').addEventListener('click',()=>setMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape'&&byId('professorMenu').classList.contains('open'))setMenu(false)});
    if(!localStorage.getItem('atlas_sinbad_professor_learner_v1')&&byId('learnerName'))byId('learnerName').value='Öğrenci';if(byId('learnerTitle'))byId('learnerTitle').value=localStorage.getItem('sinbad_learner_title')||'';
    shortenLegacyWelcome();const messages=byId('academyMessages');if(messages)new MutationObserver(()=>{updateBoard();updateSpeakerLabels()}).observe(messages,{childList:true,subtree:true});updateBoard();updateSpeakerLabels();
    const compact=byId('nativeCompactStatus'),status=byId('academyInstructorStatus');if(status)new MutationObserver(()=>{compact.textContent=status.textContent}).observe(status,{childList:true,characterData:true,subtree:true});
    bridge?.dispatchEvent(new Event('load'));
    const enroll=byId('enrollVoiceIdentity'),remove=byId('deleteVoiceIdentity'),consent=byId('voiceIdentityConsent'),voiceStatus=byId('voiceIdentityStatus');
    byId('saveLearnerName')?.addEventListener('click',()=>{localStorage.setItem('sinbad_learner_title',byId('learnerTitle')?.value||'');updateSpeakerLabels()});
    async function refreshVoiceStatus(){try{const profiles=await window.SinbadSpeakerIdentity?.all?.()||[],current=profiles.find(item=>item.id==='local-learner');voiceStatus.textContent=current?.voiceprint?`Ses kimliği hazır: ${current.title?`${current.title} `:''}${current.name} · ${current.samples.length}/${window.SinbadSpeakerIdentity.MIN_SAMPLES} örnek`:current?`Ses kimliği hazırlanıyor · ${current.samples.length}/${window.SinbadSpeakerIdentity.MIN_SAMPLES} örnek`:'Kayıtlı ses kimliği yok.'}catch(error){voiceStatus.textContent=error.message||'Ses kimliği bu tarayıcıda kullanılamıyor.';enroll.disabled=true}}
    enroll?.addEventListener('click',async()=>{enroll.disabled=true;voiceStatus.textContent='Lütfen doğal sesinizle birkaç saniye konuşun…';try{const record=await window.SinbadSpeakerIdentity.enroll({id:'local-learner',name:byId('learnerName').value,title:byId('learnerTitle').value,consent:consent.checked});voiceStatus.textContent=record.voiceprint?'Ses kimliği hazır.':'Örnek alındı; iki örnek daha gerekli.'}catch(error){voiceStatus.textContent=error.message||String(error)}finally{enroll.disabled=false}});
    remove?.addEventListener('click',async()=>{await window.SinbadSpeakerIdentity.remove('local-learner');window.SinbadSpeakerIdentity.stopMonitor();window.SinbadSpeakerIdentity.setActive(null);consent.checked=false;refreshVoiceStatus()});refreshVoiceStatus();
  });
})();

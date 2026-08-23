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
  window.SinbadProfessorBoard={claimForAnimation(){byId('professorBlackboard').dataset.owner='animation'},releaseToLesson(){byId('professorBlackboard').dataset.owner='auto';updateBoard()},write(text){byId('professorBlackboardText').textContent=String(text||'').slice(0,900)}};
  window.addEventListener('load',()=>{
    byId('openProfessorMenu').addEventListener('click',()=>setMenu(true));byId('closeProfessorMenu').addEventListener('click',()=>setMenu(false));byId('nativeMenuBackdrop').addEventListener('click',()=>setMenu(false));document.addEventListener('keydown',event=>{if(event.key==='Escape'&&byId('professorMenu').classList.contains('open'))setMenu(false)});
    shortenLegacyWelcome();const messages=byId('academyMessages');if(messages)new MutationObserver(updateBoard).observe(messages,{childList:true,subtree:true});updateBoard();
    const compact=byId('nativeCompactStatus'),status=byId('academyInstructorStatus');if(status)new MutationObserver(()=>{compact.textContent=status.textContent}).observe(status,{childList:true,characterData:true,subtree:true});
    bridge?.dispatchEvent(new Event('load'));
  });
})();

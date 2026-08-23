'use strict';
(function(){
  const frame=document.getElementById('phaseOneClassroom'),toggle=document.getElementById('toggleHandsFree'),status=document.getElementById('handsfreeStatus');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let enabled=false,recognition=null,listening=false,awaitingAnswer=false,restartTimer=null,lastFinal='';
  const setStatus=text=>{status.textContent=text};
  const setToggle=()=>{toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'⏹ Eller serbest: Açık':'🎧 Eller serbest: Kapalı'};
  const classroom=()=>frame.contentDocument;
  const clearRestart=()=>{if(restartTimer){clearTimeout(restartTimer);restartTimer=null}};
  function stopRecognition(){clearRestart();if(!recognition)return;try{recognition.abort()}catch{}listening=false}
  function scheduleListening(delay=350){clearRestart();if(!enabled||awaitingAnswer)return;restartTimer=setTimeout(startListening,delay)}
  function sinbadIsSpeaking(){try{return Boolean(frame.contentWindow?.speechSynthesis?.speaking)}catch{return false}}
  function startListening(){
    if(!enabled||awaitingAnswer||listening||sinbadIsSpeaking())return scheduleListening(500);
    if(!recognition)return;
    lastFinal='';
    try{recognition.start()}catch{scheduleListening(500)}
  }
  function submitTranscript(text){
    const clean=String(text||'').trim(),doc=classroom();
    if(!clean||!doc||awaitingAnswer)return;
    const input=doc.getElementById('academyQuestion'),form=doc.getElementById('academyChatForm');
    if(!input||!form){setStatus('Sınıf henüz hazır değil.');return scheduleListening(700)}
    awaitingAnswer=true;stopRecognition();input.value=clean;setStatus(`Gönderiliyor: “${clean}”`);form.requestSubmit();
  }
  function setupRecognition(){
    if(!Recognition){toggle.disabled=true;setStatus('Bu tarayıcı sürekli sesli diyaloğu desteklemiyor. Yazılı sohbet kullanılabilir.');return}
    recognition=new Recognition();recognition.lang='tr-TR';recognition.interimResults=true;recognition.continuous=false;
    recognition.onstart=()=>{listening=true;setStatus('Dinliyorum… Konuşabilirsiniz.')};
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)lastFinal+=text;else interim+=text}
      setStatus(lastFinal?`Duydum: “${lastFinal.trim()}”`:interim?`Dinliyorum: “${interim.trim()}”`:'Dinliyorum…');
    };
    recognition.onerror=event=>{listening=false;if(event.error==='not-allowed'||event.error==='service-not-allowed'){enabled=false;setToggle();setStatus('Mikrofon izni verilmedi. Tarayıcı site izinlerinden mikrofonu açın.');return}if(event.error!=='aborted'&&event.error!=='no-speech')setStatus(`Ses tanıma durdu: ${event.error}`)};
    recognition.onend=()=>{listening=false;if(lastFinal.trim())submitTranscript(lastFinal);else scheduleListening(300)};
  }
  function connectClassroom(){
    const doc=classroom(),messages=doc?.getElementById('academyMessages'),stage=doc?.getElementById('academyInstructorStage');
    if(!messages||!stage)return setStatus('Sınıf yükleniyor…');
    let previousCount=messages.children.length;
    const resumeWhenReady=()=>{if(!enabled||!awaitingAnswer)return;const items=[...messages.querySelectorAll('.academy-message')],last=items.at(-1);if(items.length>previousCount&&last?.classList.contains('sinbad')){previousCount=items.length;const deadline=Date.now()+8000;let observedSpeech=false;const waitForVoice=()=>{if(!enabled)return;const speaking=sinbadIsSpeaking()||stage.dataset.state==='speaking';observedSpeech=observedSpeech||speaking;if(speaking||(stage.dataset.state==='thinking'&&Date.now()<deadline&&!observedSpeech))return setTimeout(waitForVoice,250);awaitingAnswer=false;setStatus('Cevap tamamlandı. Yeni sorunuzu dinliyorum…');scheduleListening(250)};setTimeout(waitForVoice,250)}};
    new MutationObserver(resumeWhenReady).observe(messages,{childList:true});
    setStatus(enabled?'Hazır — dinleme başlatılıyor.':'Kapalı — başlatmak için düğmeye basın.');if(enabled)scheduleListening(250);
  }
  toggle.addEventListener('click',()=>{enabled=!enabled;setToggle();if(!enabled){awaitingAnswer=false;stopRecognition();setStatus('Kapalı — mikrofon dinlemiyor.')}else{setStatus('Başlatılıyor…');scheduleListening(100)}});
  frame.addEventListener('load',connectClassroom);window.addEventListener('beforeunload',stopRecognition);
  setupRecognition();setToggle();if(frame.contentDocument?.readyState==='complete')connectClassroom();
})();

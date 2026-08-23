'use strict';
(function(){
  const frame=document.getElementById('phaseOneClassroom'),toggle=document.getElementById('toggleHandsFree'),status=document.getElementById('handsfreeStatus');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let enabled=false,recognition=null,listening=false,awaitingAnswer=false,restartTimer=null,bargeTimer=null,lastFinal='',liveTranscript='',listeningPurpose='question',turnGeneration=0,bargeInDetected=false;
  const setStatus=text=>{status.textContent=text};
  const setToggle=()=>{toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'⏹ Eller serbest: Açık':'🎧 Eller serbest: Kapalı'};
  const classroom=()=>frame.contentDocument;
  const clearRestart=()=>{if(restartTimer){clearTimeout(restartTimer);restartTimer=null}};
  function clearBargeTimer(){if(bargeTimer){clearTimeout(bargeTimer);bargeTimer=null}}
  function stopRecognition(){clearRestart();clearBargeTimer();if(!recognition)return;listening=false;lastFinal='';liveTranscript='';bargeInDetected=false;try{recognition.abort()}catch{}}
  function scheduleListening(delay=350){clearRestart();if(!enabled||awaitingAnswer)return;restartTimer=setTimeout(startListening,delay)}
  function sinbadIsSpeaking(){try{return Boolean(frame.contentWindow?.speechSynthesis?.speaking||classroom()?.getElementById('academyInstructorStage')?.dataset.state==='speaking')}catch{return false}}
  function startRecognition(purpose){
    if(!enabled||listening||!recognition)return;
    if(purpose==='question'&&(awaitingAnswer||sinbadIsSpeaking()))return scheduleListening(500);
    if(purpose==='interrupt'&&(!awaitingAnswer||!sinbadIsSpeaking()))return;
    listeningPurpose=purpose;lastFinal='';liveTranscript='';bargeInDetected=false;
    try{recognition.start()}catch{if(purpose==='question')scheduleListening(500)}
  }
  function startListening(){
    if(!enabled||awaitingAnswer||listening||sinbadIsSpeaking())return scheduleListening(500);
    startRecognition('question');
  }
  function startInterruptionListening(){if(enabled&&awaitingAnswer&&sinbadIsSpeaking()&&!listening)startRecognition('interrupt')}
  function normalizeSpeech(text){return String(text||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9çğıöşü\s]/gi,' ').replace(/\s+/g,' ').trim()}
  function isInterruption(text){return /\b(?:sinbad|simbad|sinbat|sin bat|isim bat)\b/u.test(normalizeSpeech(text))}
  function stopSinbadVoice(){const doc=classroom();try{doc?.getElementById('academyStopVoice')?.click()}catch{try{frame.contentWindow?.speechSynthesis?.cancel()}catch{}}}
  function armBargeIn(text){
    if(bargeInDetected||!isInterruption(text))return;
    bargeInDetected=true;stopSinbadVoice();setStatus('Sizi duydum; anlatımı durdurdum. Sorunuzu tamamlayın…');
  }
  function scheduleBargeInFinish(){clearBargeTimer();bargeTimer=setTimeout(()=>{if(listening&&bargeInDetected){try{recognition.stop()}catch{try{recognition.abort()}catch{}}}},1100)}
  function interruptSinbad(text){
    const clean=String(text||'').trim(),doc=classroom();if(!clean||!doc)return;
    stopSinbadVoice();bargeInDetected=false;clearBargeTimer();
    awaitingAnswer=false;setStatus(`Araya girdiniz: “${clean}”`);submitTranscript(clean);
  }
  function submitTranscript(text){
    const clean=String(text||'').trim(),doc=classroom();
    if(!clean||!doc||awaitingAnswer)return;
    const input=doc.getElementById('academyQuestion'),form=doc.getElementById('academyChatForm');
    if(!input||!form){setStatus('Sınıf henüz hazır değil.');return scheduleListening(700)}
    turnGeneration+=1;awaitingAnswer=true;stopRecognition();input.value=clean;setStatus(`Gönderiliyor: “${clean}”`);form.requestSubmit();
  }
  function setupRecognition(){
    if(!Recognition){toggle.disabled=true;setStatus('Bu tarayıcı sürekli sesli diyaloğu desteklemiyor. Yazılı sohbet kullanılabilir.');return}
    recognition=new Recognition();recognition.lang='tr-TR';recognition.interimResults=true;recognition.continuous=false;
    recognition.onstart=()=>{listening=true;setStatus(listeningPurpose==='interrupt'?'Sinbad anlatıyor; araya girmek için “Sinbad…” diye başlayın.':'Dinliyorum… Konuşabilirsiniz.')};
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)lastFinal+=text;else interim+=text}
      liveTranscript=`${lastFinal} ${interim}`.trim();
      if(listeningPurpose==='interrupt'){armBargeIn(liveTranscript);if(bargeInDetected)scheduleBargeInFinish()}
      if(listeningPurpose==='interrupt')setStatus(lastFinal?`Kesme isteği duyuldu: “${lastFinal.trim()}”`:interim?`Araya giriş dinleniyor: “${interim.trim()}”`:'Sinbad anlatıyor; sizi de dinliyorum.');
      else setStatus(lastFinal?`Duydum: “${lastFinal.trim()}”`:interim?`Dinliyorum: “${interim.trim()}”`:'Dinliyorum…');
    };
    recognition.onerror=event=>{listening=false;if(event.error==='not-allowed'||event.error==='service-not-allowed'){enabled=false;setToggle();setStatus('Mikrofon izni verilmedi. Tarayıcı site izinlerinden mikrofonu açın.');return}if(event.error!=='aborted'&&event.error!=='no-speech')setStatus(`Ses tanıma durdu: ${event.error}`)};
    recognition.onend=()=>{const purpose=listeningPurpose,heard=(lastFinal.trim()||liveTranscript.trim());listening=false;clearBargeTimer();if(purpose==='interrupt'){if(heard&&isInterruption(heard))interruptSinbad(heard);else if(enabled&&awaitingAnswer)setTimeout(startInterruptionListening,120);return}if(heard)submitTranscript(heard);else scheduleListening(200)};
  }
  function connectClassroom(){
    const doc=classroom(),messages=doc?.getElementById('academyMessages'),stage=doc?.getElementById('academyInstructorStage');
    if(!messages||!stage)return setStatus('Sınıf yükleniyor…');
    let previousCount=messages.children.length;
    const resumeWhenReady=()=>{if(!enabled||!awaitingAnswer)return;const items=[...messages.querySelectorAll('.academy-message')],last=items.at(-1);if(items.length>previousCount&&last?.classList.contains('sinbad')){previousCount=items.length;const answerTurn=turnGeneration,deadline=Date.now()+8000;let observedSpeech=false;const waitForVoice=()=>{if(!enabled||answerTurn!==turnGeneration)return;if(bargeInDetected)return setTimeout(waitForVoice,100);const speaking=sinbadIsSpeaking()||stage.dataset.state==='speaking';observedSpeech=observedSpeech||speaking;if(speaking){startInterruptionListening();return setTimeout(waitForVoice,150)}if(stage.dataset.state==='thinking'&&Date.now()<deadline&&!observedSpeech)return setTimeout(waitForVoice,200);stopRecognition();awaitingAnswer=false;setStatus('Cevap tamamlandı. Yeni sorunuzu dinliyorum…');scheduleListening(150)};setTimeout(waitForVoice,150)}};
    new MutationObserver(resumeWhenReady).observe(messages,{childList:true});
    setStatus(enabled?'Hazır — dinleme başlatılıyor.':'Kapalı — başlatmak için düğmeye basın.');if(enabled)scheduleListening(250);
  }
  toggle.addEventListener('click',()=>{enabled=!enabled;setToggle();if(!enabled){awaitingAnswer=false;stopRecognition();setStatus('Kapalı — mikrofon dinlemiyor.')}else{setStatus('Başlatılıyor…');scheduleListening(100)}});
  frame.addEventListener('load',connectClassroom);window.addEventListener('beforeunload',stopRecognition);
  setupRecognition();setToggle();if(frame.contentDocument?.readyState==='complete')connectClassroom();
})();

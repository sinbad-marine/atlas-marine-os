'use strict';
(function(){
  const frame=document.getElementById('phaseOneClassroom'),toggle=document.getElementById('toggleHandsFree'),status=document.getElementById('handsfreeStatus');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const END_OF_SPEECH_MS=900,WAKE_WINDOW_MS=12000;
  let enabled=false,recognition=null,listening=false,awaitingAnswer=false,restartTimer=null,silenceTimer=null,wakeTimer=null;
  let lastFinal='',liveTranscript='',listeningPurpose='sleep',turnGeneration=0,wakeArmed=false,wakeDetectedThisRun=false;
  const setStatus=text=>{status.textContent=text};
  const setToggle=()=>{toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'⏹ Eller serbest: Açık':'🎧 Eller serbest: Kapalı'};
  const classroom=()=>frame.contentDocument;
  const clearTimer=name=>{if(name==='restart'&&restartTimer){clearTimeout(restartTimer);restartTimer=null}if(name==='silence'&&silenceTimer){clearTimeout(silenceTimer);silenceTimer=null}if(name==='wake'&&wakeTimer){clearTimeout(wakeTimer);wakeTimer=null}};
  const clearAllTimers=()=>{clearTimer('restart');clearTimer('silence');clearTimer('wake')};
  function normalizeSpeech(text){return String(text||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9çğıöşü\s]/gi,' ').replace(/\s+/g,' ').trim()}
  function wakeMatch(text){return normalizeSpeech(text).match(/\b(?:kaptan|kapitan)\s+(?:sinbad|simbad|sinbat|sin bat|isim bat)\b/u)}
  function hasWakePhrase(text){return Boolean(wakeMatch(text))}
  function questionAfterWake(text){const value=String(text||'').trim();const match=value.match(/(?:^|\s)(?:kaptan|kapitan)\s+(?:sinbad|simbad|sinbat|sin\s+bat|isim\s+bat)\b[\s,;:.!?-]*/iu);return match?value.slice((match.index||0)+match[0].length).trim():value}
  function disarmWake(){wakeArmed=false;wakeDetectedThisRun=false;clearTimer('wake')}
  function armWake(){wakeArmed=true;wakeDetectedThisRun=true;clearTimer('wake');wakeTimer=setTimeout(()=>{if(!awaitingAnswer){disarmWake();setStatus('Uyku modundayım. Bana “Kaptan Sinbad” diye seslenin.')}},WAKE_WINDOW_MS)}
  function stopRecognition(){clearTimer('restart');clearTimer('silence');if(!recognition)return;listening=false;lastFinal='';liveTranscript='';wakeDetectedThisRun=false;try{recognition.abort()}catch{}}
  function scheduleListening(delay=120){clearTimer('restart');if(!enabled||awaitingAnswer)return;restartTimer=setTimeout(startListening,delay)}
  function sinbadIsSpeaking(){try{return Boolean(frame.contentWindow?.speechSynthesis?.speaking||classroom()?.getElementById('academyInstructorStage')?.dataset.state==='speaking')}catch{return false}}
  function stopSinbadVoice(){const doc=classroom();try{doc?.getElementById('academyStopVoice')?.click()}catch{try{frame.contentWindow?.speechSynthesis?.cancel()}catch{}}}
  function finishAfterSilence(){clearTimer('silence');silenceTimer=setTimeout(()=>{if(listening&&wakeArmed){try{recognition.stop()}catch{try{recognition.abort()}catch{}}}},END_OF_SPEECH_MS)}
  function startRecognition(purpose){
    if(!enabled||listening||!recognition)return;
    if(purpose!=='interrupt'&&(awaitingAnswer||sinbadIsSpeaking()))return scheduleListening(120);
    if(purpose==='interrupt'&&(!awaitingAnswer||!sinbadIsSpeaking()))return;
    listeningPurpose=purpose;lastFinal='';liveTranscript='';wakeDetectedThisRun=false;
    try{recognition.start()}catch{scheduleListening(180)}
  }
  function startListening(){if(!enabled||awaitingAnswer||listening||sinbadIsSpeaking())return scheduleListening(120);startRecognition(wakeArmed?'question':'sleep')}
  function startInterruptionListening(){if(enabled&&awaitingAnswer&&sinbadIsSpeaking()&&!listening)startRecognition('interrupt')}
  function submitTranscript(text){
    const clean=String(text||'').trim(),doc=classroom();if(!clean||!doc||awaitingAnswer)return;
    const input=doc.getElementById('academyQuestion'),form=doc.getElementById('academyChatForm');
    if(!input||!form){setStatus('Sınıf henüz hazır değil.');return scheduleListening(300)}
    turnGeneration+=1;awaitingAnswer=true;disarmWake();stopRecognition();input.value=clean;setStatus('Sorunuz alındı; Sinbad düşünüyor…');form.requestSubmit();
  }
  function processSpeechActivity(){
    const heard=liveTranscript.trim();
    if(!wakeArmed&&hasWakePhrase(heard)){
      armWake();
      if(listeningPurpose==='interrupt'){turnGeneration+=1;awaitingAnswer=false;stopSinbadVoice();setStatus('Sizi duydum; anlatımı durdurdum. Sorunuzu tamamlayın…')}
      else setStatus('Dinliyorum Kaptan; sorunuzu tamamlayın…');
    }
    if(!wakeArmed){setStatus('Uyku modundayım. Bana “Kaptan Sinbad” diye seslenin.');return}
    const question=questionAfterWake(heard);
    if(question)setStatus(`Dinliyorum: “${question}”`);else setStatus('Uyandım Kaptan. Sorunuzu dinliyorum…');
    finishAfterSilence();
  }
  function setupRecognition(){
    if(!Recognition){toggle.disabled=true;setStatus('Bu tarayıcı sürekli sesli diyaloğu desteklemiyor. Yazılı sohbet kullanılabilir.');return}
    recognition=new Recognition();recognition.lang='tr-TR';recognition.interimResults=true;recognition.continuous=true;
    recognition.onstart=()=>{listening=true;setStatus(wakeArmed?'Dinliyorum Kaptan; sorunuzu tamamlayın…':sinbadIsSpeaking()?'Sinbad anlatıyor; araya girmek için “Kaptan Sinbad” deyin.':'Uyku modundayım. Bana “Kaptan Sinbad” diye seslenin.')};
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)lastFinal+=`${text} `;else interim+=text}
      liveTranscript=`${lastFinal} ${interim}`.trim();processSpeechActivity();
    };
    recognition.onerror=event=>{listening=false;clearTimer('silence');if(event.error==='not-allowed'||event.error==='service-not-allowed'){enabled=false;disarmWake();setToggle();setStatus('Mikrofon izni verilmedi. Tarayıcı site izinlerinden mikrofonu açın.');return}if(event.error!=='aborted'&&event.error!=='no-speech')setStatus(`Ses tanıma durdu: ${event.error}`)};
    recognition.onend=()=>{
      const heard=(lastFinal.trim()||liveTranscript.trim()),question=wakeArmed?questionAfterWake(heard):'';
      listening=false;clearTimer('silence');lastFinal='';liveTranscript='';
      if(!enabled)return;
      if(awaitingAnswer)return;
      if(wakeArmed&&question)return submitTranscript(question);
      if(wakeArmed){setStatus('Uyandım Kaptan. Sorunuzu dinliyorum…');return scheduleListening(80)}
      setStatus('Uyku modundayım. Bana “Kaptan Sinbad” diye seslenin.');scheduleListening(120);
    };
  }
  function connectClassroom(){
    const doc=classroom(),messages=doc?.getElementById('academyMessages'),stage=doc?.getElementById('academyInstructorStage');
    if(!messages||!stage)return setStatus('Sınıf yükleniyor…');
    let previousCount=messages.children.length;
    const resumeWhenReady=()=>{if(!enabled||!awaitingAnswer)return;const items=[...messages.querySelectorAll('.academy-message')],last=items.at(-1);if(items.length>previousCount&&last?.classList.contains('sinbad')){previousCount=items.length;const answerTurn=turnGeneration,deadline=Date.now()+3000;let observedSpeech=false;const waitForVoice=()=>{if(!enabled||answerTurn!==turnGeneration)return;const speaking=sinbadIsSpeaking()||stage.dataset.state==='speaking';observedSpeech=observedSpeech||speaking;if(speaking){startInterruptionListening();return setTimeout(waitForVoice,80)}if(stage.dataset.state==='thinking'&&Date.now()<deadline&&!observedSpeech)return setTimeout(waitForVoice,80);stopRecognition();awaitingAnswer=false;disarmWake();setStatus('Cevap tamamlandı. Uyku moduna geçtim; “Kaptan Sinbad” diyerek uyandırın.');scheduleListening(80)};setTimeout(waitForVoice,40)}};
    new MutationObserver(resumeWhenReady).observe(messages,{childList:true});
    setStatus(enabled?'Uyku modundayım. Bana “Kaptan Sinbad” diye seslenin.':'Kapalı — başlatmak için düğmeye basın.');if(enabled)scheduleListening(80);
  }
  toggle.addEventListener('click',()=>{enabled=!enabled;setToggle();if(!enabled){awaitingAnswer=false;disarmWake();stopRecognition();setStatus('Kapalı — mikrofon dinlemiyor.')}else{setStatus('Uyku modu başlatılıyor…');scheduleListening(60)}});
  frame.addEventListener('load',connectClassroom);window.addEventListener('beforeunload',()=>{clearAllTimers();stopRecognition()});
  setupRecognition();setToggle();if(frame.contentDocument?.readyState==='complete')connectClassroom();
})();

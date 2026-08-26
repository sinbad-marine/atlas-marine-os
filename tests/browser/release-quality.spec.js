'use strict';
const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;

const stubBridge=page=>page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({routes:0,library:{chunks:0},status:'STUDIO_RUNTIME_INCOMPLETE'})}));

test('release shell renders without mojibake or console errors',async({page})=>{
  await stubBridge(page);
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/');
  await expect(page).toHaveTitle('Sinbad Marine');
  await expect(page.locator('html')).toHaveAttribute('lang','tr');
  await expect(page.locator('body')).not.toContainText(/Ã.|â€|ï¿½|Â./u);
  await expect(page.getByRole('heading',{name:'SINBAD MARINE'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('chat history rejects corrupt storage and remains bounded during long sessions',async({page})=>{
  await stubBridge(page);
  await page.addInitScript(()=>localStorage.setItem('atlas_sinbad_messages','{corrupt-json'));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'SINBAD MARINE'})).toBeVisible();
  const bounded=await page.evaluate(()=>{
    for(let index=0;index<85;index++)addSinbadMessage(index%2?'user':'sinbad',`bounded-message-${index}`);
    const persisted=JSON.parse(localStorage.getItem('atlas_sinbad_messages'));
    return {memory:sinbadState.messages.length,persisted:persisted.length,first:sinbadState.messages[0].text,last:sinbadState.messages.at(-1).text};
  });
  expect(bounded).toEqual({memory:80,persisted:80,first:'bounded-message-5',last:'bounded-message-84'});
});

test('visible application shell has no automatically detectable WCAG A/AA violations',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('member sign-in dialog has no automatically detectable WCAG A/AA violations',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.getByRole('button',{name:'Üye Girişi'}).click();
  await expect(page.getByRole('heading',{name:'Member Sign In'})).toBeVisible();
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('large Captain Sinbad portrait loads the four-layer articulated rig with its fallback hidden',async({page},testInfo)=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{
    document.body.classList.remove('auth-pending','signed-out');
    document.body.classList.add('authenticated');
    document.querySelector('#sinbad')?.classList.add('active');
  });
  const avatar=page.locator('.sinbad-avatar.large');
  await expect(avatar).toHaveAttribute('data-rig-ready','true');
  await expect(avatar.locator('.sinbad-rig-part')).toHaveCount(4);
  await expect(avatar.locator('.sinbad-rig-face-frame')).toHaveCount(7);
  await expect(avatar.locator('.sinbad-rig-stage')).toHaveCSS('opacity','1');
  await expect(avatar.locator(':scope > .sinbad-avatar-img').first()).toHaveCSS('opacity','0');
  const restingArm=await avatar.locator('.sinbad-rig-right-arm').evaluate(element=>getComputedStyle(element).transform);
  const restingLeftArm=await avatar.locator('.sinbad-rig-left-arm').evaluate(element=>getComputedStyle(element).transform);
  await page.evaluate(()=>setSinbadAssistantState('speaking',{gesture:'show-palm',motionProfile:'lively'}));
  await page.waitForTimeout(150);
  await expect(avatar).toHaveAttribute('data-gaze','palm');
  const showingPalm=await avatar.locator('.sinbad-rig-right-arm').evaluate(element=>getComputedStyle(element).transform);
  expect(showingPalm).not.toBe(restingArm);
  await page.waitForTimeout(450);
  await expect(avatar).toHaveAttribute('data-gaze','audience');
  await page.evaluate(()=>setSinbadAssistantState('speaking',{gesture:'raise-left',motionProfile:'measured'}));
  await page.waitForTimeout(150);
  await expect(avatar).toHaveAttribute('data-gaze','left-palm');
  const raisedLeftArm=await avatar.locator('.sinbad-rig-left-arm').evaluate(element=>getComputedStyle(element).transform);
  expect(raisedLeftArm).not.toBe(restingLeftArm);
  await page.waitForTimeout(450);
  await expect(avatar).toHaveAttribute('data-gaze','audience');
  await page.evaluate(()=>applySinbadLivePerformanceCue({gesture:'show-palm',gaze:'palm',emotion:'warm',energy:.4},{speechBoundary:'word'}));
  await page.waitForTimeout(700);
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');
  await expect(avatar).toHaveAttribute('data-gaze','palm');
  await expect(avatar).toHaveAttribute('data-speech-boundary','word');
  const adaptiveDuration=await avatar.evaluate(element=>getComputedStyle(element).getPropertyValue('--sinbad-motion-duration'));
  expect(Number.parseInt(adaptiveDuration,10)).toBeGreaterThanOrEqual(280);
  expect(Number.parseInt(adaptiveDuration,10)).toBeLessThanOrEqual(1200);
  await page.evaluate(()=>applySinbadLivePerformanceCue({gesture:'open-hand-left',gaze:'audience',emotion:'warm',energy:.4},{speechBoundary:'word'}));
  await page.waitForTimeout(700);
  await expect(avatar).toHaveAttribute('data-gesture-side','left');
  const liveLeftArm=await avatar.locator('.sinbad-rig-left-arm').evaluate(element=>getComputedStyle(element).transform);
  expect(liveLeftArm).not.toBe(restingLeftArm);
  await page.waitForTimeout(80);
  await page.evaluate(()=>applySinbadLivePerformanceCue({gesture:'show-left-palm',gaze:'left-palm',emotion:'warm',energy:.38},{speechBoundary:'word'}));
  await expect(avatar).toHaveAttribute('data-motion-interrupted','true');
  await expect(avatar).toHaveAttribute('data-gesture','show-left-palm');
  await expect(avatar).toHaveAttribute('data-gaze','left-palm');
  await page.waitForTimeout(700);
  const liveCueArm=await avatar.locator('.sinbad-rig-left-arm').evaluate(element=>getComputedStyle(element).transform);
  expect(liveCueArm).not.toBe(restingLeftArm);
  await page.evaluate(()=>setSinbadAssistantState('presenting',{gesture:'show-both-hands',gaze:'audience',emotion:'attentive',energy:.44}));
  await expect(avatar).toHaveAttribute('data-gaze','left-palm');
  await page.waitForTimeout(400);
  await expect(avatar).toHaveAttribute('data-gaze','palm');
  await page.waitForTimeout(400);
  await expect(avatar).toHaveAttribute('data-gaze','audience');
  await page.evaluate(()=>setSinbadAssistantState('speaking',{gesture:'rest',gaze:'audience',emotion:'warm',energy:.3}));
  await page.evaluate(()=>setSinbadMouthFrame('closed'));
  await expect(avatar.locator('.sinbad-rig-face-closed')).toHaveCSS('opacity','1');
  await page.evaluate(()=>setSinbadMouthFrame('wide'));
  await expect(avatar.locator('.sinbad-rig-face-wide')).toHaveCSS('opacity','1');
  await page.evaluate(()=>setSinbadMouthFrame('round'));
  await page.waitForTimeout(75);
  await expect(avatar.locator('.sinbad-rig-face-round')).toHaveCSS('opacity','1');
  await expect(avatar.locator('.sinbad-rig-expression-delighted')).toHaveCSS('opacity','1');
  await expect(avatar.locator('.sinbad-rig-head-base')).toHaveCSS('opacity','0');
  if(testInfo.project.name==='desktop-chromium')await avatar.screenshot({path:'test-results/sinbad-layered-rig-preview.png'});
  await page.evaluate(()=>setSinbadAssistantState('warning'));
  await expect(avatar.locator('.sinbad-rig-expression-concerned')).toHaveCSS('opacity','1');
  const heardMeaning=await page.evaluate(()=>{
    const result=SinbadPerformanceDirector.listeningCueForText('Dikkat, yangın var.',1);
    setSinbadAssistantState('listening',{...result.cue,listeningActivity:'interim',listeningMeaning:result.meaning});
    return result.meaning;
  });
  expect(heardMeaning).toBe('caution');
  await expect(avatar).toHaveAttribute('data-listening-meaning','caution');
  await expect(avatar).toHaveAttribute('data-gesture','hold');
  await expect(avatar.locator('.sinbad-rig-expression-concerned')).toHaveCSS('opacity','1');
  const variedListening=await page.evaluate(()=>{
    const director=SinbadPerformanceDirector.createListeningReactionDirector({entropy:()=>.01});
    const first=director.select('Bunu nasıl yapacağız?',1),second=director.select('Bunu nasıl yapacağız?',2);
    setSinbadAssistantState('listening',{...second.cue,listeningActivity:'interim',listeningMeaning:second.meaning,listeningReaction:second.reactionId});
    return [first.reactionId,second.reactionId];
  });
  expect(variedListening[0]).not.toBe(variedListening[1]);
  await expect(avatar).toHaveAttribute('data-listening-meaning','question');
  await expect(avatar).toHaveAttribute('data-listening-reaction',variedListening[1]);
  await page.evaluate(()=>{setSinbadAssistantState('idle');document.querySelector('.sinbad-avatar.large')?.classList.add('sinbad-blinking');});
  await page.waitForTimeout(75);
  await expect(avatar.locator('.sinbad-rig-face-blink')).toHaveCSS('opacity','1');
  const turnTaking=await page.evaluate(()=>{
    addSinbadMessage('sinbad','Bu yanıtın sesli sunumu kullanıcı tarafından kesilecek.');
    const marked=markSinbadResponseInterrupted('Bu yanıtın sesli sunumu kullanıcı tarafından kesilecek.');
    const preservedContext=sinbadHistoryForModel(false).at(-1)?.content||'';
    const directives=['devam et','baştan anlat','kısaca özetle'].map(text=>resolveSinbadTurnDirective(text));
    const ambiguous=resolveSinbadTurnDirective('Devam dostum, başka bir konuya geçelim.');
    const messageCount=document.querySelectorAll('#sinbadMessages > *').length;
    class RecognitionStub{start(){this.onstart?.();}abort(){this.onend?.();}stop(){this.onend?.();}}
    Object.defineProperty(window,'SpeechRecognition',{value:RecognitionStub,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{value:RecognitionStub,configurable:true});
    setSinbadAssistantState('speaking',{gesture:'explain',emotion:'warm'});
    startSinbadListening();
    return {marked,preservedContext,directives,ambiguous,messageCount,afterCount:document.querySelectorAll('#sinbadMessages > *').length};
  });
  expect(turnTaking.marked).toBe(true);
  expect(turnTaking.preservedContext).toContain('do not automatically resume');
  expect(turnTaking.directives.map(item=>item.action)).toEqual(['continue','restart','summarize']);
  expect(turnTaking.directives[0].question).toContain('do not claim to resume audio');
  expect(turnTaking.ambiguous.reason).toBe('NO_TURN_DIRECTIVE');
  expect(turnTaking.afterCount).toBe(turnTaking.messageCount);
  await expect(avatar).toHaveAttribute('data-state','listening');
  await expect(page.locator('#startSinbadListening')).toHaveAttribute('aria-pressed','true');
});

test('character runtime releases live resources on pagehide and resumes from a neutral pose',async({page})=>{
  await stubBridge(page);await page.goto('/');
  const lifecycle=await page.evaluate(()=>{
    window.__lifecycleAbortCount=0;
    class RecognitionStub{start(){this.onstart?.();}abort(){window.__lifecycleAbortCount++;this.onend?.();}}
    Object.defineProperty(window,'SpeechRecognition',{value:RecognitionStub,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{value:RecognitionStub,configurable:true});
    sinbadState.voiceEnabled=true;sinbadHandsFreeEnabled=true;beginSinbadRecognition();
    setSinbadAssistantState('walking',{gesture:'walk',gaze:'path',emotion:'warm',energy:.62});
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    const hidden={suspended:sinbadCharacterRuntimeSuspended,listening:sinbadIsListening,handsFree:sinbadHandsFreeEnabled,recognition:sinbadRecognition,assistantTimers:sinbadAssistantTimers.length,abortCount:window.__lifecycleAbortCount};
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    return {hidden,resumed:{suspended:sinbadCharacterRuntimeSuspended,state:sinbadAssistantState,gesture:document.querySelector('.sinbad-avatar.large')?.dataset.gesture}};
  });
  expect(lifecycle.hidden).toEqual({suspended:true,listening:false,handsFree:false,recognition:null,assistantTimers:0,abortCount:1});
  expect(lifecycle.resumed).toEqual({suspended:false,state:'idle',gesture:'rest'});
});

test('layered character survives a 500-transition browser soak and releases every scheduled cue',async({page})=>{
  await stubBridge(page);await page.goto('/');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const result=await page.evaluate(()=>{
    const states=[
      ['idle',{gesture:'rest',gaze:'audience',emotion:'warm',energy:.18}],
      ['listening',{gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.3}],
      ['thinking',{gesture:'hold',gaze:'thought',emotion:'curious',energy:.24}],
      ['presenting',{gesture:'open-hand',gaze:'audience',emotion:'confident',energy:.36}],
      ['speaking',{gesture:'explain',gaze:'audience',emotion:'warm',energy:.4,responseKind:'explanation'}],
      ['laughing',{gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.6}],
      ['walking',{gesture:'walk',gaze:'path',emotion:'warm',energy:.62}],
      ['warning',{gesture:'hold',gaze:'audience',emotion:'concerned',energy:.28}]
    ];
    for(let index=0;index<500;index++){const [state,cue]=states[index%states.length];setSinbadAssistantState(state,cue);}
    const before={state:sinbadAssistantState,timers:sinbadAssistantTimers.length,rigGeneration:sinbadAvatarImageGeneration};
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    const released={timers:sinbadAssistantTimers.length,blink:sinbadBlinkTimer,idle:sinbadIdleMotionTimer,raf:sinbadLipSyncRaf,suspended:sinbadCharacterRuntimeSuspended};
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    const avatar=document.querySelector('.sinbad-avatar.large');
    return {before,released,after:{state:sinbadAssistantState,gesture:avatar?.dataset.gesture,rigReady:avatar?.dataset.rigReady,parts:avatar?.querySelectorAll('.sinbad-rig-part').length}};
  });
  expect(result.before.state).toBe('presenting');expect(result.before.rigGeneration).toBeGreaterThanOrEqual(500);
  expect(result.released).toEqual({timers:0,blink:null,idle:null,raf:null,suspended:true});
  expect(result.after).toEqual({state:'idle',gesture:'rest',rigReady:'true',parts:4});expect(errors).toEqual([]);
});

test('live Sinbad chat grounds body answers in the gesture actually shown',async({page})=>{
  test.setTimeout(90000);
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{
    document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    document.querySelector('#sinbad')?.classList.add('active');
    sinbadState.voiceEnabled=false;
  });
  const avatar=page.locator('.sinbad-avatar.large');
  const answer=page.locator('#sinbadMessages .chat-bubble.sinbad').last();
  const ask=async text=>{await page.locator('#sinbadInput').fill(text);await page.locator('#sendSinbad').click();};

  await page.evaluate(()=>setSinbadAssistantState('idle',{gesture:'rest',gaze:'audience',emotion:'warm',energy:.18}));
  await ask('Beni dinliyor musun?');
  await expect(answer).toContainText('Hayır; mikrofon dinleme oturumu şu an açık değil. Yazdığın mesajı okuyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await page.evaluate(()=>{sinbadIsListening=true;sinbadHandsFreeEnabled=true;setSinbadAssistantState('listening',{gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.3,listeningActivity:'speech'});});
  await ask('Beni duyuyor musun?');
  await expect(answer).toContainText('Evet; mikrofon dinleme oturumu şu an etkin ve seni dinliyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','listen-lean');
  await expect.poll(()=>page.evaluate(()=>({listening:sinbadIsListening,handsFree:sinbadHandsFreeEnabled,recognition:sinbadRecognition}))).toEqual({listening:false,handsFree:false,recognition:null});
  await ask('Hangi elini kullanıyorsun?');
  await expect(answer).toContainText('Şu an belirgin bir el hareketi kullanmıyorum; ellerim dinlenme pozunda.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await expect(avatar).toHaveAttribute('data-gesture-hands','none');

  await ask('Sinbad avucunun içinde bir şey mi var?');
  await expect(answer).toContainText('Avucumu açıp gösteriyorum; mevcut karakter görünümünde avucumda bir nesne gösterilmiyor.');
  await expect(answer).not.toContainText('güçlü bir eşleşme bulamadım');
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');

  await ask('Sinbad, elini indir.');
  await expect(answer).toContainText('Hareketi durdurdum ve nötr poza döndüm.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');

  await ask('Tahtaya bir yıldız çiz.');
  await expect(answer).toContainText('Bu hareketi henüz güvenilir biçimde yapamıyorum.');
  await expect(avatar).not.toHaveAttribute('data-gesture','point-board');

  await ask('Bana el salla.');
  await expect(answer).toContainText('Sana gülümseyerek el sallıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture',/^wave-right(?:-away)?$/u);
  await ask('Neden bana el salladın?');
  await expect(answer).toContainText('şimdi yeniden sallıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture',/^wave-right(?:-away)?$/u);

  await ask('Biraz gül.');
  await expect(answer).toContainText('Kısa bir kahkahayla sana eşlik ediyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','laugh');
  await ask('Neden güldün?');
  await expect(answer).toContainText('şimdi yeniden kısa bir kahkaha atıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture',/^(?:laugh|nod)$/u);

  await ask('Başını sola çevir.');
  await expect(answer).toContainText('Başımı sola çeviriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','look-left');
  await ask('Neden başını sola çevirdin?');
  await expect(answer).toContainText('şimdi yeniden çeviriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','look-left');
  await page.evaluate(()=>setSinbadAssistantState('presenting',{gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24}));
  await page.waitForTimeout(900);
  await expect(avatar).toHaveAttribute('data-gesture','look-left');
  await ask('Başın şu an hangi tarafa dönük?');
  await expect(answer).toContainText('Başım şu an sola dönük.');
  await expect(avatar).toHaveAttribute('data-gesture','look-left');

  await ask('Tekrar bana bak.');
  await expect(answer).toContainText('Başımı yeniden ortaya çevirip sana bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await ask('Aynı hareketi tekrar yap.');
  await expect(answer).toContainText('Başımı yeniden ortaya çevirip sana bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await ask('Neden tekrar bana baktın?');
  await expect(answer).toContainText('şimdi yeniden sana bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await expect(avatar).toHaveAttribute('data-gaze','audience');
  await ask('Şu an bana mı bakıyorsun?');
  await expect(answer).toContainText('Evet, şu an sana bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gaze','audience');
  await ask('Tahtaya bak.');
  await expect(answer).toContainText('Bakışımı tahtaya çeviriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await expect(avatar).toHaveAttribute('data-gaze','board');
  await ask('Bana bakıyor musun?');
  await expect(answer).toContainText('Hayır; şu an tahtaya bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gaze','board');
  await ask('Neden tahtaya baktın?');
  await expect(answer).toContainText('şimdi yeniden tahtaya bakıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await expect(avatar).toHaveAttribute('data-gaze','board');

  await page.evaluate(()=>setSinbadAssistantState('presenting',{gesture:'nod',gaze:'audience',emotion:'attentive',energy:.26}));
  await page.waitForTimeout(700);
  await ask('Başın şu an aşağı mı eğik?');
  await expect(answer).toContainText('Başım şu an aşağı doğru eğik.');
  await expect(avatar).toHaveAttribute('data-gesture','nod');

  await page.evaluate(()=>setSinbadAssistantState('success',{gesture:'nod',gaze:'audience',emotion:'joyful',energy:.5,completionDurationMs:1800}));
  await page.waitForTimeout(700);
  await ask('Şu an gülümsüyor musun?');
  await expect(answer).toContainText('Evet, şu an gülümsüyorum.');
  await expect(avatar).toHaveAttribute('data-emotion','joyful');

  await page.evaluate(()=>setSinbadAssistantState('listening',{gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.3,listeningActivity:'interim'}));
  await page.waitForTimeout(700);
  await ask('Şu an öne mi eğildin?');
  await expect(answer).toContainText('Şu an gövdem öne doğru eğik.');

  await page.evaluate(()=>setSinbadAssistantState('walking',{gesture:'walk',gaze:'path',emotion:'warm',energy:.72}));
  await page.waitForTimeout(700);
  await ask('Hareket enerjin nasıl?');
  await expect(answer).toContainText('Şu an animasyon hareket enerjim yüksek.');

  await page.evaluate(()=>setSinbadAssistantState('presenting',{gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.4}));
  await page.waitForTimeout(900);
  await ask('Şu an pozun nasıl?');
  await expect(answer).toContainText('gövdem dik; başım sola dönük ve düz; yüzüm sakin ve nötr; hareket enerjim orta.');

  await ask('Sinbad, omuzlarını silk.');
  await expect(answer).toContainText('Omuzlarımı silkerek karşılık veriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','shrug');

  const uncertainReaction=await page.evaluate(()=>{
    const director=SinbadPerformanceDirector.createListeningReactionDirector({entropy:()=>.999});
    const result=director.select('Emin değilim, kafam karıştı.',1);
    setSinbadAssistantState('listening',{...result.cue,listeningActivity:'interim',listeningMeaning:result.meaning,listeningReaction:result.reactionId});
    return result.reactionId;
  });
  expect(uncertainReaction).toBe('uncertainty-shrug');
  await expect(avatar).toHaveAttribute('data-gesture','shrug');
  await expect(avatar).toHaveAttribute('data-listening-meaning','uncertainty');

  const uncertaintySpeech=await page.evaluate(()=>{
    const semantic=SinbadPerformanceDirector.responseCueForText('Bu sonucu doğrulayamıyorum; yeterli kanıt yok.','warm').cue;
    const director=SinbadPerformanceDirector.createImprovisationDirector({entropy:()=>0});
    const selected=director.choose(semantic.responseKind,'speech',{preferredFamily:'reflective',preferenceReason:'EPISTEMIC_UNCERTAINTY'}).cue;
    setSinbadAssistantState('speaking',{...semantic,...selected,responseKind:semantic.responseKind});
    return semantic.responseKind;
  });
  expect(uncertaintySpeech).toBe('uncertainty');
  await expect(avatar).toHaveAttribute('data-response-kind','uncertainty');
  await expect(avatar).toHaveAttribute('data-gesture','shrug');
  await expect(page.locator('#sinbadAvatarStatus')).toHaveText('Belirsizliği açıklıyor');
  const uncertaintyEnding=await page.evaluate(()=>{
    const text='Bu sonucu doğrulayamıyorum.';
    return SinbadPerformanceDirector.speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:3,mode:'warm'}).cue;
  });
  expect(uncertaintyEnding.responseKind).toBe('uncertainty');
  expect(uncertaintyEnding.gesture).toBe('hold');
  expect(uncertaintyEnding.gaze).toBe('thought');
  expect(uncertaintyEnding.gesture).not.toBe('nod');
  await ask('Neden omuzlarını silktin?');
  await expect(answer).toContainText('Sonucun kesin olmadığını ve kanıtın yetersiz kaldığını beden diliyle göstermek için omuzlarımı silktim.');
  const cautionEnding=await page.evaluate(()=>{
    const text='Dikkat, rota emniyet sınırını aşıyor.';
    return SinbadPerformanceDirector.speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:5,mode:'caution'}).cue;
  });
  expect(cautionEnding.responseKind).toBe('caution');
  expect(cautionEnding.gesture).toBe('hold');
  expect(cautionEnding.emotion).toBe('concerned');
  expect(cautionEnding.gesture).not.toBe('nod');
  const correctionSpeech=await page.evaluate(()=>{
    const text='Bu bilgi yanlış.';
    const semantic=SinbadPerformanceDirector.responseCueForText(text,'warm').cue;
    setSinbadAssistantState('speaking',semantic);
    return {semantic,ending:SinbadPerformanceDirector.speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:2,mode:'warm'}).cue};
  });
  expect(correctionSpeech.semantic.responseKind).toBe('correction');
  expect(correctionSpeech.semantic.gesture).toBe('shake-head-left');
  expect(correctionSpeech.ending.gesture).toBe('hold');
  expect(correctionSpeech.ending.gesture).not.toBe('nod');
  await expect(avatar).toHaveAttribute('data-response-kind','correction');
  await expect(page.locator('#sinbadAvatarStatus')).toHaveText('Bilgiyi düzeltiyor');
  const negativeSpeech=await page.evaluate(()=>{
    const text='Hayır, bunu yapamam.';
    const semantic=SinbadPerformanceDirector.responseCueForText(text,'warm').cue;
    setSinbadAssistantState('speaking',semantic);
    return {semantic,ending:SinbadPerformanceDirector.speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:3,mode:'warm'}).cue};
  });
  expect(negativeSpeech.semantic.responseKind).toBe('negative');
  expect(negativeSpeech.semantic.gesture).toBe('shake-head-left');
  expect(negativeSpeech.ending.gesture).toBe('hold');
  expect(negativeSpeech.ending.gesture).not.toBe('nod');
  await expect(avatar).toHaveAttribute('data-response-kind','negative');
  await expect(page.locator('#sinbadAvatarStatus')).toHaveText('Neden yapamayacağını açıklıyor');
  const negativeVariants=await page.evaluate(()=>{
    const director=SinbadPerformanceDirector.createImprovisationDirector({entropy:()=>0});
    return [director.choose('negative','speech',{preferredFamily:'corrective',preferenceReason:'EXPLICIT_REFUSAL'}).cue.gesture,director.choose('negative','speech',{preferredFamily:'corrective',preferenceReason:'EXPLICIT_REFUSAL'}).cue.gesture];
  });
  expect(new Set(negativeVariants).size).toBe(2);
  expect(negativeVariants.every(gesture=>['shake-head-left','shake-head-right'].includes(gesture))).toBe(true);
  await ask('Neden başını iki yana salladın?');
  await expect(answer).toContainText('Olumsuz yanıt verdiğimi beden diliyle açıkça göstermek için başımı iki yana salladım.');

  await ask('Sağ elini göster.');
  await expect(answer).toContainText('Sağ avucumu açıp gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');
  await ask('Şimdi öbür elini göster.');
  await expect(answer).toContainText('Sol elimi kaldırıp gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-left-palm');
  await ask('Hangi elini kullanıyorsun?');
  await expect(answer).toContainText('Şu an sol kolumu kullanıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture-side','left');
  await expect(avatar).toHaveAttribute('data-gesture','show-left-palm');
  await ask('Sol avucunda bir şey mi var?');
  await expect(answer).toContainText('Sol avucumu açıp gösteriyorum; mevcut karakter görünümünde sol avucumda bir nesne gösterilmiyor.');
  await expect(avatar).toHaveAttribute('data-gesture','show-left-palm');
  await expect(avatar).toHaveAttribute('data-gaze','left-palm');
  await ask('Peki öbür avucunda bir şey var mı?');
  await expect(answer).toContainText('Sağ avucumu açıp gösteriyorum; mevcut karakter görünümünde sağ avucumda bir nesne gösterilmiyor.');
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');
  await expect(avatar).toHaveAttribute('data-gaze','palm');
  await ask('İki avucunda da bir şey var mı?');
  await expect(answer).toContainText('İki avucumu birlikte gösteriyorum; mevcut karakter görünümünde avuçlarımda bir nesne gösterilmiyor.');
  await expect(avatar).toHaveAttribute('data-gesture','show-both-hands');
  await expect(avatar).toHaveAttribute('data-gesture-side','center');
  await expect(avatar).toHaveAttribute('data-gesture-hands','both');
  await ask('Hangi elini kullanıyorsun?');
  await expect(answer).toContainText('Şu an iki elimi birlikte kullanıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-both-hands');
  await expect(avatar).toHaveAttribute('data-gesture-hands','both');
  await ask('Neden avucunu açtın?');
  await expect(answer).toContainText('Elimi görünür biçimde göstermek ve soruna beden diliyle karşılık vermek için avucumu açmıştım; şimdi yeniden gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-both-hands');

  await ask('Önce sağ elini göster, sonra sol elini kaldır.');
  await expect(answer).toContainText('Önce sağ avucumu, ardından sol elimi gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-left-palm',{timeout:2500});
  await ask('Son iki hareketin neydi?');
  await expect(answer).toContainText('Önce sağ avucumu gösterdim; ardından sol elimi kaldırdım.');
  await page.evaluate(()=>{window.__verifiedReplayGestures=[];new MutationObserver(()=>window.__verifiedReplayGestures.push(document.querySelector('.sinbad-avatar.large')?.dataset.gesture)).observe(document.querySelector('.sinbad-avatar.large'),{attributes:true,attributeFilter:['data-gesture']});});
  await ask('Son iki hareketini tekrar yap.');
  await expect(answer).toContainText('Doğrulanmış son iki hareketimi aynı sırayla yeniden yapıyorum.');
  await page.waitForTimeout(2600);
  const replayedGestures=await page.evaluate(()=>window.__verifiedReplayGestures);
  expect(replayedGestures).toContain('show-palm');expect(replayedGestures).toContain('show-left-palm');
  expect(replayedGestures.indexOf('show-palm')).toBeLessThan(replayedGestures.indexOf('show-left-palm'));
  await page.evaluate(()=>{window.__interruptedReplayGestures=[];new MutationObserver(()=>window.__interruptedReplayGestures.push(document.querySelector('.sinbad-avatar.large')?.dataset.gesture)).observe(document.querySelector('.sinbad-avatar.large'),{attributes:true,attributeFilter:['data-gesture']});});
  await ask('Aynı ikisini bir daha yap.');
  await expect(answer).toContainText('Doğrulanmış son iki hareketimi aynı sırayla yeniden yapıyorum.');
  await page.waitForTimeout(550);await ask('Dur.');
  await expect(answer).toContainText('Hareketi durdurdum ve nötr poza döndüm.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  const interruptedCount=await page.evaluate(()=>window.__interruptedReplayGestures.length);await page.waitForTimeout(1800);
  expect(await page.evaluate(()=>window.__interruptedReplayGestures.length)).toBe(interruptedCount);
  await expect(avatar).toHaveAttribute('data-gesture','rest');
  await page.evaluate(()=>{document.documentElement.classList.add('sinbad-force-reduced-motion');window.__reducedReplayGestures=[];new MutationObserver(()=>window.__reducedReplayGestures.push(document.querySelector('.sinbad-avatar.large')?.dataset.gesture)).observe(document.querySelector('.sinbad-avatar.large'),{attributes:true,attributeFilter:['data-gesture']});});
  await ask('Hareket azaltma açık mı?');
  await expect(answer).toContainText('Evet, hareket azaltma tercihi şu an açık; uzun animasyon dizilerini oynatmıyorum.');
  await ask('Aynı ikisini tekrar yap.');
  await expect(answer).toContainText('Hareket azaltma tercihin açık olduğu için iki hareketlik animasyon dizisini oynatmıyorum.');
  await page.waitForTimeout(900);expect(await page.evaluate(()=>window.__reducedReplayGestures.filter(gesture=>['show-palm','show-left-palm'].includes(gesture)).length)).toBe(0);
  await page.evaluate(()=>document.documentElement.classList.remove('sinbad-force-reduced-motion'));
  await ask('Hareket azaltma açık mı?');
  await expect(answer).toContainText('Hayır, hareket azaltma tercihi şu an açık değil.');
  await ask('Hareketleri azalt.');
  await expect(answer).toContainText('Hareket azaltma tercihini açtım; uzun ve tekrarlı animasyonları oynatmayacağım.');
  expect(await page.evaluate(()=>({forced:document.documentElement.classList.contains('sinbad-force-reduced-motion'),stored:localStorage.getItem('atlas_sinbad_reduced_motion')}))).toEqual({forced:true,stored:'on'});
  await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','true');
  await ask('Normal hareketlere dön.');
  await expect(answer).toContainText('Uygulama içindeki hareket azaltma tercihini kapattım.');
  expect(await page.evaluate(()=>({forced:document.documentElement.classList.contains('sinbad-force-reduced-motion'),stored:localStorage.getItem('atlas_sinbad_reduced_motion')}))).toEqual({forced:false,stored:'off'});
  await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','false');
  await page.locator('#toggleSinbadReducedMotion').click();await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','true');
  await page.locator('#toggleSinbadReducedMotion').click();await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','false');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('#toggleSinbadReducedMotion')).toHaveAttribute('aria-pressed','false');

  await ask('Sinbad bana el sallar mısın?');
  await expect(answer).toContainText('Sana gülümseyerek el sallıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','wave-right-away',{timeout:2500});

  await ask('Sinbad biraz gülsene.');
  await expect(answer).toContainText('Kısa bir kahkahayla sana eşlik ediyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','laugh',{timeout:2500});
  await expect(avatar.locator('.sinbad-rig-expression-delighted')).toHaveCSS('opacity','1');

  await ask('Sinbad biraz yürü.');
  await expect(answer).toContainText('Kısa ve kontrollü bir yürüyüş yapıyorum.');
  await expect(avatar).toHaveAttribute('data-state','walking');
  await expect(avatar).toHaveAttribute('data-gesture','walk');

  await ask('Hayır anlamında başını salla.');
  await expect(answer).toContainText('Başımı iki yana sallayarak hayır işareti yapıyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','shake-head-right',{timeout:2500});

  await ask('Başını eğ.');
  await expect(answer).toContainText('Başımı eğerek yanıt veriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture',/^nod(?:-up)?$/u,{timeout:2500});

  await ask('İki elini aynı anda göster.');
  await expect(answer).toContainText('İki elimi aynı anda açıp gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-both-hands',{timeout:2500});
});

test('stored reduced-motion preference is restored on a real reload',async({page})=>{
  await stubBridge(page);await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('atlas_sinbad_reduced_motion','on'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/sinbad-force-reduced-motion/u);
  expect(await page.evaluate(()=>localStorage.getItem('atlas_sinbad_reduced_motion'))).toBe('on');
});

test('idle Sinbad performs a sparse real micro-motion and yields immediately to work',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');document.querySelector('#sinbad')?.classList.add('active');setSinbadAssistantState('idle');});
  await page.waitForFunction(()=>Boolean(document.querySelector('.sinbad-avatar.large')?.dataset.idleMotion),null,{timeout:12000});
  const avatar=page.locator('.sinbad-avatar.large');
  await expect(avatar).toHaveAttribute('data-idle-motion',/^(breathe|look-left|look-right)$/);
  await expect(avatar).toHaveAttribute('data-gesture',/^idle-(breathe|look-left|look-right)$/);
  await page.waitForTimeout(150);
  const idleVisual=await avatar.locator('.sinbad-rig-head-base').evaluate(element=>({
    transform:getComputedStyle(element).transform,
    headX:getComputedStyle(element).getPropertyValue('--sinbad-rig-head-x'),
    headY:getComputedStyle(element).getPropertyValue('--sinbad-rig-head-y'),
    lean:getComputedStyle(element).getPropertyValue('--sinbad-rig-lean')
  }));
  expect(idleVisual.transform).not.toBe('none');
  expect([idleVisual.headX,idleVisual.headY,idleVisual.lean].some(value=>!/^0(?:\.00)?deg$/.test(value))).toBe(true);
  await page.evaluate(()=>setSinbadAssistantState('thinking',{thinkingStage:'analyzing'}));
  await expect(avatar).toHaveAttribute('data-state','thinking');
  await expect(avatar).not.toHaveAttribute('data-idle-motion',/.+/);
});

test('a short speech pause joins one user turn instead of submitting mid-sentence',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{
    document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    window.__sinbadRecognitionStubs=[];
    class RecognitionStub{
      constructor(){window.__sinbadRecognitionStubs.push(this);}
      start(){this.onstart?.();}
      abort(){this.onend?.();}
      stop(){this.onend?.();}
    }
    Object.defineProperty(window,'SpeechRecognition',{value:RecognitionStub,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{value:RecognitionStub,configurable:true});
    startSinbadListening();
    const first=window.__sinbadRecognitionStubs[0],results=[[{transcript:'Hey Sinbad rotayı'}]];results[0].isFinal=true;
    first.onspeechstart?.();first.onresult?.({resultIndex:0,results});first.onend?.();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('#sinbadMessages .chat-bubble.user')).toHaveCount(0);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-listening-activity','continuation');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-listening-pace','fast');
  await page.waitForFunction(()=>window.__sinbadRecognitionStubs?.length>=2&&typeof window.__sinbadRecognitionStubs[1].onresult==='function',null,{polling:10});
  await page.evaluate(()=>{
    const second=window.__sinbadRecognitionStubs[1],results=[[{transcript:'göster'}]];results[0].isFinal=true;
    second.onspeechstart?.();second.onresult?.({resultIndex:0,results});second.onend?.();
  });
  await page.waitForTimeout(1300);
  await expect(page.locator('#sinbadMessages .chat-bubble.user').last()).toContainText('rotayı göster');
});

test('Sinbad Academy opens outside the main app as a standalone classroom window',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  const popupPromise=page.waitForEvent('popup');
  await page.evaluate(()=>openSinbadAcademyWindow());
  const classroom=await popupPromise;
  await classroom.waitForLoadState();
  await expect(classroom).toHaveURL(/academy\.html$/);
  await expect(classroom.getByRole('heading',{name:'Navigation Classroom'})).toBeVisible();
  await expect(page.locator('#sinbadAcademyWindow')).toHaveCount(0);
  await classroom.getByRole('button',{name:'Open lesson'}).click();
  await expect(classroom.locator('#academyOutput')).toContainText('Learning objectives');
  await classroom.close();
});

test('live Sinbad chat writes bounded plain text on the real Academy board',async({page})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{
    document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    document.querySelector('#sinbad')?.classList.add('active');sinbadState.voiceEnabled=false;
  });
  const popupPromise=page.waitForEvent('popup');
  await page.locator('#sinbadInput').fill('Tahtaya Pruva 090 yaz.');
  await page.locator('#sendSinbad').click();
  const classroom=await popupPromise;
  await classroom.waitForLoadState();
  await expect(classroom.locator('#academyTeachingStage')).toBeVisible();
  await expect(classroom.locator('#academyTeachingText')).toContainText('Pruva 090',{timeout:5000});
  await expect(classroom.locator('.academy-sinbad')).toHaveAttribute('data-state','board-teaching');
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına “Pruva 090” yazıyorum.');
  await page.locator('#sinbadInput').fill('Tahtaya bir daire çiz.');
  await page.locator('#sendSinbad').click();
  await expect(classroom.locator('#academyTeachingText svg[aria-label="Sinbad drew a circle"]')).toBeVisible();
  await expect(classroom.locator('#academyTeachingText circle')).toHaveCSS('stroke-dashoffset','0px',{timeout:3000});
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına bir daire çiziyorum.');
  await page.locator('#sinbadInput').fill('Tahtaya bir altıgen çiz.');
  await page.locator('#sendSinbad').click();
  await expect(classroom.locator('#academyTeachingText svg[aria-label="Sinbad drew a hexagon"][data-board-shape="hexagon"] path')).toBeVisible();
  await expect(classroom.locator('#academyTeachingText path')).toHaveCSS('stroke-dashoffset','0px',{timeout:3000});
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına bir altıgen çiziyorum.');
  await page.locator('#sinbadInput').fill('Bu şeklin kaç kenarı var?');
  await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Tahtadaki doğrulanmış altıgenin 6 kenarı vardır.');
  await page.locator('#sinbadInput').fill('Neden?');
  await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Çünkü altıgenin kapalı sınırı altı düz kenarın uç uca birleşmesiyle oluşur.');
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');
  await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText(/(?:Altıgenin kaç kenarı vardır\?|Tahtadaki altıgenin kenar sayısı nedir\?|Bu altıgeni oluşturan kaç düz kenar görüyorsun\?)/u);
  await page.locator('#sinbadInput').fill('Bu şeklin kaç kenarı var?');
  await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru cevabı açıklamadan bir kez daha denemeni istiyorum.');
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).not.toContainText('Altıgenin altı kenarı vardır.');
  await page.locator('#sinbadInput').fill('Altı.');
  await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru. İkinci denemende cevabını düzelttin; tahtadaki şekille uyuşuyor.');
  await page.locator('#sinbadInput').fill('Tahtaya bir üçgen çiz.');
  await page.locator('#sendSinbad').click();
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="triangle"] path')).toBeVisible();
  await expect(classroom.locator('#academyTeachingText path')).toHaveCSS('stroke-dashoffset','0px',{timeout:3000});
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına bir üçgen çiziyorum.');
  await page.locator('#sinbadInput').fill('Bu altıgenin kaç kenarı var?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('tahtadaki şekil üçgen. Başka bir şeklin özelliğini buna aitmiş gibi söylemeyeceğim.');
  await page.locator('#sinbadInput').fill('Bu üçgenin kaç kenarı var?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Tahtadaki doğrulanmış üçgenin 3 kenarı vardır.');
  const triangleRhythm=await classroom.locator('#academyTeachingStage').getAttribute('data-board-drawing-rhythm');expect(['steady','measured','lively']).toContain(triangleRhythm);
  await classroom.evaluate(()=>{window.__shapeFrameTrace=[];window.__shapePhaseTrace=[];const image=document.querySelector('#academySinbadImage'),stage=document.querySelector('#academyTeachingStage');new MutationObserver(()=>window.__shapeFrameTrace.push(image.getAttribute('src'))).observe(image,{attributes:true,attributeFilter:['src']});new MutationObserver(()=>window.__shapePhaseTrace.push(stage.dataset.boardDrawingPhase)).observe(stage,{attributes:true,attributeFilter:['data-board-drawing-phase']});});
  await page.locator('#sinbadInput').fill('Tahtaya bir ok çiz.');
  await page.locator('#sendSinbad').click();
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="arrow"] path')).toBeVisible();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına bir ok çiziyorum.');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','complete',{timeout:3000});
  await expect(classroom.locator('#academySinbadImage')).toHaveAttribute('src',/captain-sinbad-board-teaching\.png$/u);
  const arrowRhythm=await classroom.locator('#academyTeachingStage').getAttribute('data-board-drawing-rhythm');expect(arrowRhythm).not.toBe(triangleRhythm);
  const shapeFrames=await classroom.evaluate(()=>window.__shapeFrameTrace);expect(shapeFrames.some(src=>src.includes('writing-contact-v1.png'))).toBe(true);expect(shapeFrames.some(src=>src.includes('writing-lift-v1.png'))).toBe(true);
  const shapePhases=await classroom.evaluate(()=>window.__shapePhaseTrace);expect(shapePhases).toContain('check-in');expect(shapePhases.at(-1)).toBe('complete');
  await page.locator('#sinbadInput').fill('Az önce tahtaya ne çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('En son Academy tahtasına bir ok çizdim.');
  await page.locator('#sinbadInput').fill('Tahtada ne var?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('En son Academy tahtasına bir ok çizdim.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Tahtadaki şeklin adı ne?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Bu doğrulanmış şekil bir oktur.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Bu bir altıgen mi?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Hayır; bu doğrulanmış şekil altıgen değil, ok.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','shake-head-left');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Bu bir ok mu?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Evet, bu doğrulanmış şekil bir ok.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','nod');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Neden başını eğdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('evet cevabımı beden diliyle onaylamak üzere başımı eğmiştim');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture',/^(?:nod|nod-up)$/u);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Tahtadakini göster.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Tahtadaki doğrulanmış ok şeklini gösteriyorum.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Altıgeni büyüt.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('doğrulanmış şekil ok. Başka bir şekilmiş gibi yeniden çizmeyeceğim.');
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="arrow"]')).toHaveAttribute('data-board-size','standard');
  await page.locator('#sinbadInput').fill('Tahtadaki oku küçült.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğrulanmış son şekli daha küçük çiziyorum.');
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="arrow"]')).toHaveAttribute('data-board-size','small');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture',/^(?:point-board|explain(?:-left)?|open-hand(?:-left)?|nod)$/u);
  await page.locator('#sinbadInput').fill('Tahtadaki altıgeni göster.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('doğrulanmış son şekil ok. Altıgen varmış gibi göstermeyeceğim.');
  await page.locator('#sinbadInput').fill('Tahtadaki oku göster.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Tahtadaki doğrulanmış ok şeklini gösteriyorum.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Tahtadaki altıgeni açıkla.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('doğrulanmış şekil ok. Başka bir şekli açıklamayacağım.');
  await page.locator('#sinbadInput').fill('Tahtadaki oku açıkla.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('gövdesi bir doğrultuyu, uç kısmı ise yönü gösterir');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Onu tekrar çiz.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğrulanmış son tahta işlemini yeniden uyguluyorum.');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','complete',{timeout:3000});
  await page.locator('#sinbadInput').fill('Bunu daha büyük çiz.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğrulanmış son şekli daha büyük çiziyorum.');
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="arrow"]')).toHaveAttribute('data-board-size','large');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','complete',{timeout:3000});
  await page.locator('#sinbadInput').fill('Hangi boyutta çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Son şekli büyük boyutta çizdim.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture',/^(?:point-board|explain(?:-left)?|open-hand(?:-left)?|nod)$/u);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-motion-profile',/^(?:measured|lively|thoughtful|crisp|gentle|deliberate)$/u);
  const firstBoardReferenceGesture=await page.locator('.sinbad-avatar.large').getAttribute('data-gesture');
  await page.locator('#sinbadInput').fill('Az önce tahtaya ne çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('En son Academy tahtasına bir ok çizdim.');
  expect(await page.locator('.sinbad-avatar.large').getAttribute('data-gesture')).not.toBe(firstBoardReferenceGesture);
  await page.locator('#sinbadInput').fill('Bu şekli açıkla.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('gövdesi bir doğrultuyu, uç kısmı ise yönü gösterir');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  const firstQuestionText=await page.locator('#sinbadMessages .chat-bubble.sinbad').last().textContent();
  expect(firstQuestionText).toMatch(/Okun uç kısmı|Ok başı|okun uç kısmından/iu);
  await page.locator('#sinbadInput').fill('Neden?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Önce soruyu cevaplamanı');
  const firstQuestionPrompt=firstQuestionText.replace('Captain Sinbad','').trim();
  await page.locator('#sinbadInput').fill('Soruyu tekrar eder misin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText(firstQuestionPrompt);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Bir ipucu verir misin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Okun sivri uç kısmına ve işaret ettiği tarafa bak.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('İpucu ver.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Ok gövdesinin hangi tarafa doğru uzandığını düşün.');
  await page.locator('#sinbadInput').fill('İpucu ver.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('İki doğrulanmış ipucu verdim.');
  await page.locator('#sinbadInput').fill('Yönü gösterir.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru. Cevabın tahtadaki şekille uyuşuyor.');
  const firstCorrectGesture=await page.locator('.sinbad-avatar.large').getAttribute('data-gesture');
  expect(['nod','open-hand','open-hand-left','explain','explain-left','rest']).toContain(firstCorrectGesture);
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  const secondQuestionText=await page.locator('#sinbadMessages .chat-bubble.sinbad').last().textContent();
  expect(secondQuestionText).toMatch(/Okun uç kısmı|Ok başı|okun uç kısmından/iu);
  expect(secondQuestionText).not.toBe(firstQuestionText);
  await page.locator('#sinbadInput').fill('Yönü gösterir.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru. Cevabın tahtadaki şekille uyuşuyor.');
  const secondCorrectGesture=await page.locator('.sinbad-avatar.large').getAttribute('data-gesture');
  expect(['nod','open-hand','open-hand-left','explain','explain-left','rest']).toContain(secondCorrectGesture);
  expect(secondCorrectGesture).not.toBe(firstCorrectGesture);
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  await page.locator('#sinbadInput').fill('Doğru cevabı söyle.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru cevap: Okun uç kısmı yönü gösterir.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','point-board');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Neden?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('sivri uç kısmı, gövdesinin hangi tarafa yöneldiğini');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Neden tahtayı işaret ettin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Anlattığım doğrulanmış tahta içeriğine dikkatini yöneltmek için tahtayı işaret etmiştim; şimdi yeniden gösteriyorum.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','point-board');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  await page.locator('#sinbadInput').fill('Üç kenarı vardır.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru cevabı açıklamadan bir kez daha denemeni istiyorum.');
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).not.toContainText('Okun uç kısmı yönü gösterir.');
  const firstCorrectionGesture=await page.locator('.sinbad-avatar.large').getAttribute('data-gesture');
  expect(['shake-head-left','shake-head-right','open-hand','hold','explain']).toContain(firstCorrectionGesture);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','point-board',{timeout:1200});
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Yönü gösterir.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('İkinci denemende cevabını düzelttin');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','nod');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','open-hand',{timeout:1200});
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  await page.locator('#sinbadInput').fill('Üç kenarı vardır.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru cevabı açıklamadan bir kez daha denemeni istiyorum.');
  const secondCorrectionGesture=await page.locator('.sinbad-avatar.large').getAttribute('data-gesture');
  expect(['shake-head-left','shake-head-right','open-hand','hold','explain']).toContain(secondCorrectionGesture);
  expect(secondCorrectionGesture).not.toBe(firstCorrectionGesture);
  await page.locator('#sinbadInput').fill('Yine üç kenarı vardır.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Soruyu burada kapatıyorum.');
  await page.locator('#sinbadInput').fill('Merhaba');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Merhaba Kaptan. Sinbad aktif.');
  await classroom.evaluate(()=>{
    window.__clearPhaseTrace=[];window.__clearFrameTrace=[];
    const image=document.querySelector('#academySinbadImage'),stage=document.querySelector('#academyTeachingStage');
    new MutationObserver(()=>window.__clearPhaseTrace.push(stage.dataset.boardDrawingPhase)).observe(stage,{attributes:true,attributeFilter:['data-board-drawing-phase']});
    new MutationObserver(()=>window.__clearFrameTrace.push(image.getAttribute('src'))).observe(image,{attributes:true,attributeFilter:['src']});
  });
  await page.locator('#sinbadInput').fill('Tahtayı temizle.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasını temizliyorum.');
  await expect(classroom.locator('#academyTeachingText')).toBeEmpty();
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','clear');
  const clearPhases=await classroom.evaluate(()=>window.__clearPhaseTrace);
  expect(clearPhases).toContain('erasing');expect(clearPhases.at(-1)).toBe('clear');
  const clearFrames=await classroom.evaluate(()=>window.__clearFrameTrace);
  expect(clearFrames.some(src=>/captain-sinbad-writing-(?:contact|lift)-v1\.png$/u.test(src))).toBe(true);
  await page.locator('#sinbadInput').fill('Az önce tahtaya ne çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('başarıyla uygulanmış bir işlem kaydım yok');
  await classroom.close();
});

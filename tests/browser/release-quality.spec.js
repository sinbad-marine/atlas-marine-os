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
  await page.waitForTimeout(80);
  await page.evaluate(()=>applySinbadLivePerformanceCue({gesture:'raise-left',gaze:'left-palm',emotion:'warm',energy:.38},{speechBoundary:'word'}));
  await expect(avatar).toHaveAttribute('data-motion-interrupted','true');
  await expect(avatar).toHaveAttribute('data-gesture','raise-left');
  await expect(avatar).toHaveAttribute('data-gaze','left-palm');
  await page.waitForTimeout(700);
  const liveCueArm=await avatar.locator('.sinbad-rig-right-arm').evaluate(element=>getComputedStyle(element).transform);
  expect(liveCueArm).not.toBe(restingArm);
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

test('live Sinbad chat grounds body answers in the gesture actually shown',async({page})=>{
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

  await ask('Sinbad avucunun içinde bir şey mi var?');
  await expect(answer).toContainText('Avucumu açıp gösteriyorum; mevcut karakter görünümünde avucumda bir nesne gösterilmiyor.');
  await expect(answer).not.toContainText('güçlü bir eşleşme bulamadım');
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');

  await ask('Sinbad, elini indir.');
  await expect(answer).toContainText('Hareketi durdurdum ve nötr poza döndüm.');
  await expect(avatar).toHaveAttribute('data-gesture','rest');

  await ask('Tahtaya bir altıgen çiz.');
  await expect(answer).toContainText('Bu hareketi henüz güvenilir biçimde yapamıyorum.');
  await expect(avatar).not.toHaveAttribute('data-gesture','point-board');

  await ask('Sağ elini göster.');
  await expect(answer).toContainText('Sağ avucumu açıp gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','show-palm');
  await ask('Şimdi öbür elini göster.');
  await expect(answer).toContainText('Sol elimi kaldırıp gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','raise-left');

  await ask('Önce sağ elini göster, sonra sol elini kaldır.');
  await expect(answer).toContainText('Önce sağ avucumu, ardından sol elimi gösteriyorum.');
  await expect(avatar).toHaveAttribute('data-gesture','raise-left',{timeout:2500});
  await ask('Son iki hareketin neydi?');
  await expect(answer).toContainText('Önce sağ avucumu gösterdim; ardından sol elimi kaldırdım.');

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
  await page.locator('#sinbadInput').fill('Tahtaya bir üçgen çiz.');
  await page.locator('#sendSinbad').click();
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="triangle"] path')).toBeVisible();
  await expect(classroom.locator('#academyTeachingText path')).toHaveCSS('stroke-dashoffset','0px',{timeout:3000});
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasına bir üçgen çiziyorum.');
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
  await page.locator('#sinbadInput').fill('Onu tekrar çiz.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğrulanmış son tahta işlemini yeniden uyguluyorum.');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','complete',{timeout:3000});
  await page.locator('#sinbadInput').fill('Bunu daha büyük çiz.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğrulanmış son şekli daha büyük çiziyorum.');
  await expect(classroom.locator('#academyTeachingText svg[data-board-shape="arrow"]')).toHaveAttribute('data-board-size','large');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','complete',{timeout:3000});
  await page.locator('#sinbadInput').fill('Hangi boyutta çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Son şekli büyük boyutta çizdim.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture',/^(?:point-board|explain|open-hand|nod)$/u);
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
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Okun uç kısmı neyi gösterir?');
  await page.locator('#sinbadInput').fill('Yönü gösterir.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru. Cevabın tahtadaki şekille uyuşuyor.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','nod');
  await page.locator('#sinbadInput').fill('Bu şekille ilgili bana soru sor.');await page.locator('#sendSinbad').click();
  await page.locator('#sinbadInput').fill('Üç kenarı vardır.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Okun uç kısmı yönü gösterir.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','shake-head-left');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','point-board',{timeout:1200});
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gaze','board');
  await page.locator('#sinbadInput').fill('Yönü gösterir.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Doğru. Cevabın tahtadaki şekille uyuşuyor.');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-gesture','nod');
  await page.locator('#sinbadInput').fill('Tahtayı temizle.');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('Academy tahtasını temizliyorum.');
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','erasing');
  await expect(classroom.locator('#academySinbadImage')).toHaveAttribute('src',/captain-sinbad-writing-(?:contact|lift)-v1\.png$/u);
  await expect(classroom.locator('#academyTeachingText')).toBeEmpty();
  await expect(classroom.locator('#academyTeachingStage')).toHaveAttribute('data-board-drawing-phase','clear');
  await page.locator('#sinbadInput').fill('Az önce tahtaya ne çizdin?');await page.locator('#sendSinbad').click();
  await expect(page.locator('#sinbadMessages .chat-bubble.sinbad').last()).toContainText('başarıyla uygulanmış bir işlem kaydım yok');
  await classroom.close();
});

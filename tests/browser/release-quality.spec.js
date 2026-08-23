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
  await page.waitForTimeout(300);
  await expect(page.locator('#sinbadMessages .chat-bubble.user')).toHaveCount(0);
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-listening-activity','continuation');
  await expect(page.locator('.sinbad-avatar.large')).toHaveAttribute('data-listening-pace','fast');
  await page.waitForFunction(()=>window.__sinbadRecognitionStubs?.length>=2);
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

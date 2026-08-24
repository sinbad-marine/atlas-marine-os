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

test('Sinbad Academy opens outside the main app as a standalone classroom window',async({page,context})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  const popupPromise=context.waitForEvent('page');
  await page.evaluate(()=>openSinbadAcademyWindow());
  const classroom=await popupPromise;
  await classroom.waitForLoadState();
  await expect(classroom).toHaveURL(/academy\.html$/);
  await expect(classroom.getByRole('heading',{name:'Navigation Classroom'})).toBeVisible();
  await expect(page.locator('#sinbadAcademyWindow')).toHaveCount(0);
  await expect(classroom.locator('#academySinbadAvatar')).toBeVisible();
  await expect(classroom.locator('#academyChatForm')).toBeVisible();
  await expect(classroom.locator('#academyQuestion')).toBeVisible();
  await expect(classroom.locator('#academyMic')).toBeVisible();
  await classroom.locator('.academy-guided-tools > summary').click();
  await classroom.locator('#startAcademyLesson').click();
  await expect(classroom.locator('#academyOutput')).toContainText('Learning objectives');
  await classroom.close();
});

test('Professor Phase 2 opens separately, embeds the frozen classroom and starts a real diagnostic',async({page,context})=>{
  await stubBridge(page);
  await page.goto('/');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  const popupPromise=context.waitForEvent('page');
  await page.evaluate(()=>openSinbadProfessorWindow());
  const professor=await popupPromise;
  const errors=[];
  professor.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await professor.waitForLoadState();
  await expect(professor).toHaveURL(/academy-professor\.html$/);
  await expect(professor.getByRole('heading',{name:/Professor Workspace/})).toBeVisible();
  await expect(professor.locator('#learnerLevel')).toHaveText('foundation');
  await expect(professor.locator('#adaptiveCoach')).toBeVisible();
  await expect(professor.locator('#coachReason')).toContainText('No mastery is inferred');
  await expect(professor.locator('body')).not.toContainText(/Ã.|â€|ï¿½|Â./u);
  const accessibility=await new AxeBuilder({page:professor})
    .include('aside')
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const classroom=professor.frameLocator('#phaseOneClassroom');
  await expect(classroom.locator('#academyChatForm')).toBeVisible();
  await expect(classroom.locator('#academySinbadAvatar')).toHaveCount(1);
  await classroom.locator('#academyMessages').evaluate(box=>{const article=document.createElement('article');article.className='academy-message user';article.innerHTML='<strong>Captain</strong><p>Gelgit nasıl oluşur?</p>';box.append(article);});
  await expect(professor.locator('#chatReflection')).toBeHidden();
  await classroom.locator('#academyCloudStatus').evaluate(node=>{node.textContent='Answer ready';});
  await classroom.locator('#academyMessages').evaluate(box=>{const article=document.createElement('article');article.className='academy-message sinbad';article.innerHTML='<strong>Captain Sinbad</strong><p>Gelgit, gök cisimlerinin çekimi ve yerel hidrografiyle oluşur.</p>';box.append(article);});
  await expect(professor.locator('#chatReflection')).toBeVisible();
  await professor.locator('#reflectionUnderstood').click();
  await expect(professor.locator('#reflectionCheck')).toBeVisible();
  await expect(professor.locator('#coachReason')).toContainText('complete the knowledge check to change mastery');
  await professor.locator('#reflectionCheckChoices button').first().click();
  await expect(professor.locator('#reflectionCheckStatus')).toContainText('Correct');
  await expect(professor.locator('#coachReason')).toContainText('knowledge check answered correctly');
  await expect(professor.locator('#evidenceLedger')).toContainText('Observation only — mastery unchanged');
  await expect(professor.locator('#evidenceLedger')).toContainText('Mastery evidence');
  professor.once('dialog',dialog=>dialog.accept());
  await professor.locator('#resetLearnerProfile').click();
  await expect(professor.locator('#learnerEvidence')).toHaveText('0');
  await expect(professor.locator('#resetProfileStatus')).toContainText('Atlas documents and chats were not changed');
  await professor.locator('#startDiagnostic').click();
  await expect(professor.locator('#diagnosticQuestion')).toBeVisible();
  await expect(professor.locator('#diagnosticQuestion strong')).toContainText('1/6');
  expect(errors).toEqual([]);
  await professor.close();
});

test('hands-free Professor runs an explicit listen-send-answer-listen loop without audio recording',async({page})=>{
  await page.addInitScript(()=>{
    class FakeRecognition{
      constructor(){window.__fakeRecognition=this;this.started=0;}
      start(){this.started+=1;this.onstart?.();}
      stop(){this.onend?.();}
      abort(){this.onend?.();}
      finish(text){this.onresult?.({resultIndex:0,results:Object.assign([{0:{transcript:text},isFinal:true}],{length:1})});this.onend?.();}
    }
    window.SpeechRecognition=FakeRecognition;
  });
  await page.goto('/academy-professor-native.html');
  await expect(page.getByText('Sinbad Professor',{exact:true})).toBeVisible();
  await expect(page.locator('#toggleHandsFree')).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Sınıf araçları menüsünü aç'}).click();
  await page.locator('#toggleHandsFree').click();
  await page.getByRole('button',{name:'Menüyü kapat'}).click();
  await expect(page.locator('#toggleHandsFree')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#handsfreeStatus')).toContainText('Uyku modundayım');
  await page.evaluate(()=>window.__fakeRecognition.finish('Akşam ne yemek yapalım?'));
  await expect(page.locator('.academy-message.user')).toHaveCount(0);
  await page.evaluate(()=>window.__fakeRecognition.finish('Kaptan Sinbad, gelgit nasıl oluşur?'));
  const classroom=page;
  await expect(classroom.locator('#academyMessages')).toContainText('gelgit nasıl oluşur?');
  await expect(page.locator('#handsfreeStatus')).toContainText(/Uyku moduna geçtim|Uyku modundayım/);
  await page.getByRole('button',{name:'Sınıf araçları menüsünü aç'}).click();
  await page.locator('#toggleHandsFree').click();
  await expect(page.locator('#toggleHandsFree')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#handsfreeStatus')).toContainText('mikrofon dinlemiyor');
});

test('guided tutor shows evidence-bound objective progress without replacing the active session',async({page})=>{
  await page.goto('/academy-professor-native.html');
  await page.getByRole('button',{name:'Sınıf araçları menüsünü aç'}).click();
  await page.locator('#tutorTopic').selectOption('marine-weather');
  await page.locator('#startTutorSession').click();
  await expect(page.locator('#tutorProgress')).toBeVisible();
  await expect(page.locator('#tutorProgressLabel')).toContainText('0 /');
  await expect(page.locator('#tutorProgressBar')).toHaveAttribute('value','0');
  await expect(page.locator('#tutorObjectiveProgress li.current')).toHaveCount(1);
  await expect(page.locator('#startTutorSession')).toBeDisabled();
  await expect(page.locator('#abandonTutorSession')).toBeVisible();
});

test('student can interrupt Sinbad narration with a name-gated follow-up',async({page})=>{
  await page.addInitScript(()=>{
    class FakeRecognition{
      constructor(){(window.__recognitions||(window.__recognitions=[])).push(this);this.started=0;}
      start(){this.started+=1;this.onstart?.();}
      stop(){this.onend?.();}
      abort(){this.onend?.();}
      interim(text){this.onresult?.({resultIndex:0,results:Object.assign([{0:{transcript:text},isFinal:false}],{length:1})});}
      finish(text){this.onresult?.({resultIndex:0,results:Object.assign([{0:{transcript:text},isFinal:true}],{length:1})});this.onend?.();}
    }
    class FakeUtterance{constructor(text){this.text=text;}}
    window.SpeechRecognition=FakeRecognition;
    window.SpeechSynthesisUtterance=FakeUtterance;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speaking:false,getVoices:()=>[{lang:'tr-TR',name:'Test'}],cancel(){this.speaking=false;},speak(utterance){this.speaking=true;this.utterance=utterance;}}});
    localStorage.setItem('atlas_selected_workspace','workspace-test');
  });
  await page.route('**/vendor/supabase-2.112.3.js',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}}}),onAuthStateChange:()=>({})},functions:{invoke:async(_name,request)=>({data:{answer:'İlk açıklama devam ediyor.',spokenSummary:'İlk açıklama devam ediyor.',visuals:[],coreGateVersion:request.body.coreEnvelope.gateVersion,permission:'DECISION_SUPPORT_ONLY',executionPerformed:false},error:null})}})};`}));
  await page.goto('/academy-professor-native.html');
  await expect(page.locator('#academyCloudStatus')).toContainText('Atlas knowledge connected');
  await page.getByRole('button',{name:'Sınıf araçları menüsünü aç'}).click();
  await page.locator('#toggleHandsFree').click();
  await page.getByRole('button',{name:'Menüyü kapat'}).click();
  await expect(page.locator('#handsfreeStatus')).toContainText('Uyku modundayım');
  await page.evaluate(()=>window.__recognitions.at(-1).finish('Kaptan Sinbad, gelgit nasıl oluşur?'));
  await expect(page.locator('#academyMessages')).toContainText('İlk açıklama devam ediyor.');
  await expect(page.locator('#handsfreeStatus')).toContainText('Sinbad anlatıyor');
  await page.evaluate(()=>window.__recognitions.at(-1).interim('Kaptan Sinbad, bunu daha detaylı anlat'));
  await expect(page.locator('#handsfreeStatus')).toContainText(/Sizi duydum|Dinliyorum/);
  await page.waitForTimeout(1200);
  const classroom=page;
  await expect(classroom.locator('.academy-message.user')).toHaveCount(2);
  await expect(classroom.locator('.academy-message.user').last()).toContainText('bunu daha detaylı anlat');
});

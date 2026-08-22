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
  await expect(professor.locator('#coachReason')).toContainText('understanding confirmed by the learner');
  await professor.locator('#startDiagnostic').click();
  await expect(professor.locator('#diagnosticQuestion')).toBeVisible();
  await expect(professor.locator('#diagnosticQuestion strong')).toContainText('1/6');
  expect(errors).toEqual([]);
  await professor.close();
});

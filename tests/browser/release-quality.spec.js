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
  await page.evaluate(()=>{setSinbadAssistantState('idle');document.querySelector('.sinbad-avatar.large')?.classList.add('sinbad-blinking');});
  await page.waitForTimeout(75);
  await expect(avatar.locator('.sinbad-rig-face-blink')).toHaveCSS('opacity','1');
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

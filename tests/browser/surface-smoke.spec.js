'use strict';
const {test,expect}=require('@playwright/test');
const contract=require('../../config/ui-design-contract.json');

const prepareDashboard=async page=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"routes":0,"library":{"chunks":0},"status":"STUDIO_RUNTIME_INCOMPLETE"}'}));
  await page.goto('/index.html');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
};

test('every dashboard card opens its canonical independent resizable window',async({page,context})=>{
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await prepareDashboard(page);
  for(const id of contract.dashboardWorkspaces){
    if(id==='document-submissions')await page.locator('#developerProjectCard').evaluate(element=>element.dataset.roleHidden='false');
    const launcher=page.locator(`[data-open="${id}"]:visible`).first();
    await expect(launcher,`${id} launcher`).toBeVisible();
    const popupPromise=context.waitForEvent('page');
    await launcher.evaluate(element=>element.click());
    const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
    await popup.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
    if(id==='store')await expect(popup).toHaveURL(/\/store\/index\.html$/u);
    else{
      await expect(popup).toHaveURL(new RegExp(`workspace=${id}`,'u'));
      await expect(popup.locator(`#${id}`)).toHaveClass(/\bactive\b/u);
      await expect(popup.locator('[data-window-back]')).toBeVisible();
      await expect(popup.locator('[data-window-home]')).toBeVisible();
    }
    await popup.close();
  }
  expect(pageErrors).toEqual([]);
});

test('Captain Sinbad exposes only working Chat and Academy tabs',async({page,context})=>{
  await prepareDashboard(page);
  const popupPromise=context.waitForEvent('page');
  await page.locator('[data-open="sinbad"]:visible').first().click({force:true});
  const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  await popup.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  await expect(popup.locator('[data-sinbad-tab="chat"]')).toHaveAttribute('aria-selected','true');
  await popup.locator('[data-sinbad-tab="academy"]').click();
  await expect(popup.locator('[data-sinbad-tab="academy"]')).toHaveAttribute('aria-selected','true');
  await expect(popup.locator('#sinbad-panel-academy')).toBeVisible();
  await expect(popup.locator('[data-sinbad-tab="passage"],[data-sinbad-tab="sources"],.sinbad-tools-menu')).toHaveCount(0);
  await popup.locator('[data-sinbad-tab="chat"]').click();
  await expect(popup.locator('#sinbad-panel-chat')).toBeVisible();
  await popup.close();
});

test('Academy departments switch in the same functional classroom',async({page})=>{
  await page.goto('/academy.html');
  for(const section of ['goss-gasm','stcw','goc','general-maritime-education']){
    const tab=page.locator(`[data-academy-section="${section}"]`);
    await tab.click();
    await expect(tab).toHaveClass(/\bactive\b/u);
    await expect(page.locator('#academyTeachingStage')).toBeVisible();
    await expect(page.locator('#academyQuestionInput')).toBeVisible();
  }
});

test('authentication window switches sign-in registration and recovery panels',async({page})=>{
  await page.goto('/index.html');
  await page.locator('#openCaptainSignIn').click();
  await expect(page.locator('#signInPanel')).toBeVisible();
  await page.locator('#showRegistration').click();
  await expect(page.locator('#registrationPanel')).toBeVisible();
  await page.locator('#registrationBackToSignIn').click();
  await page.locator('#showRecovery').click();
  await expect(page.locator('#recoveryPanel')).toBeVisible();
  await page.locator('#closeAuthDialog').click();
  await expect(page.locator('#authDialog')).not.toBeVisible();
});

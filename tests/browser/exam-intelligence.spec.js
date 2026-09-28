'use strict';
const {test,expect}=require('@playwright/test');

test('Academy GOSS/GASM launches the separate fail-closed Exam Intelligence surface',async({page,context})=>{
  await context.route('http://127.0.0.1:4192/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>SINBAD Exam Intelligence</title><p>LOCAL SYNTHETIC</p>'}));
  await page.goto('/academy.html');
  await expect(page.locator('#openExamIntelligence')).toBeHidden();
  await page.locator('.academy-landing-hotspots [data-academy-open="goss-gasm"]').click({force:true});
  await expect(page.locator('[data-academy-art="goss-gasm"].is-active')).toBeVisible();
  await expect(page.locator('#academyTeachingStage')).toBeHidden();
  await expect(page.locator('#academyExamConnection')).toContainText('synthetic/local');
  const popupPromise=page.waitForEvent('popup');
  await page.locator('.academy-layer-hotspots [data-academy-scope="goss-gasm"][data-academy-command="exam"]').last().click();
  const exam=await popupPromise;
  await expect.poll(()=>exam.url()).toBe('http://127.0.0.1:4192/');
  await exam.close();
});

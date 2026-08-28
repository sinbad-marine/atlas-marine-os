'use strict';
const {test,expect}=require('@playwright/test');

test('Academy GOSS/GASM launches the separate fail-closed Exam Intelligence surface',async({page,context})=>{
  await context.route('http://127.0.0.1:4192/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>SINBAD Exam Intelligence</title><p>LOCAL SYNTHETIC</p>'}));
  await page.goto('/academy.html');
  await expect(page.locator('#openExamIntelligence')).toBeHidden();
  await page.locator('[data-academy-section="goss-gasm"]').click();
  await expect(page.locator('#openExamIntelligence')).toBeVisible();
  await expect(page.locator('#academyExamConnection')).toContainText('sentetik/yerel');
  const popupPromise=page.waitForEvent('popup');
  await page.locator('#openExamIntelligence').click();
  const exam=await popupPromise;
  await expect.poll(()=>exam.url()).toBe('http://127.0.0.1:4192/');
  await exam.close();
});

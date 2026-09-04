'use strict';
const {test,expect}=require('@playwright/test');

test('hosted exam review fails closed without an authenticated Atlas session',async({page})=>{
  await page.goto('/exam-review.html');
  await expect(page).toHaveTitle(/Yetkili İnceleme/);
  await expect(page.locator('#status')).toContainText('Oturum yok');
  await expect(page.locator('#answerKey')).toBeHidden();
  await expect(page.locator('#packageSurface')).toBeVisible();
  await expect(page.locator('#showPackages')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#ownerReviewerPanel')).toBeHidden();
  await expect(page.locator('#status')).not.toContainText(/token|secret|service.role/i);
  await expect(page.locator('a[href="./academy.html"]')).toBeVisible();
  await expect(page.locator('a[href="./index.html"]')).toBeVisible();
});

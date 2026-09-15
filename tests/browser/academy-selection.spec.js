'use strict';
const {test,expect}=require('@playwright/test');

// Owner Limited GO (2026-09-15): the chosen Academy department and training module survive a browser
// refresh. UI state only - lesson phase, board content and clock still start from the welcome state.
const SELECTION_KEY='atlas_sinbad_academy_selection';

const openClassroom=async page=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"routes":0,"library":{"chunks":0},"status":"STUDIO_RUNTIME_INCOMPLETE"}'}));
  await page.goto('/academy.html');
  await expect(page.locator('#academyModule')).toBeVisible();
};

test('classroom opens on General Maritime Education when nothing was chosen before',async({page})=>{
  await openClassroom(page);
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
});

test('chosen department and module are restored after a browser refresh',async({page})=>{
  await openClassroom(page);
  await page.locator('[data-academy-section="ism-isps-mlc"]').click();
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await expect(page.locator('#academyOwnerTraining')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-academy-section="ism-isps-mlc"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).not.toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await expect(page.locator('#academyOwnerTraining')).toBeVisible();
  await expect(page.locator('#academyTeachingStage')).toHaveAttribute('data-phase','welcome');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),SELECTION_KEY);
  expect(saved).toEqual({section:'ism-isps-mlc',module:'ism-code-foundations'});
});

test('a module chosen inside a department is restored too, and the change is remembered',async({page})=>{
  await openClassroom(page);
  await page.locator('[data-academy-section="stcw"]').click();
  await page.locator('#academyModule').selectOption('marine-weather');
  await page.reload();
  await expect(page.locator('[data-academy-section="stcw"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('marine-weather');
});

test('a stale or foreign saved selection falls back to the default department',async({page})=>{
  await openClassroom(page);
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'__proto__',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'stcw',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('[data-academy-section="stcw"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('stcw-foundation','a module outside the department is ignored');
  await page.evaluate(key=>localStorage.setItem(key,'{not json'),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
});

'use strict';
const {test,expect}=require('@playwright/test');

// Owner-approved Academy navigation: exact landing art, exact section art, then live tools on demand.
const SELECTION_KEY='atlas_sinbad_academy_selection';

const openAcademy=async page=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"routes":0,"library":{"chunks":0},"status":"STUDIO_RUNTIME_INCOMPLETE"}'}));
  await page.goto('/academy.html');
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('#academyWorkspace')).toBeHidden();
};

const openLayer=async(page,section)=>{
  await page.locator(`.academy-landing-hotspots [data-academy-open="${section}"]`).click({force:true});
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','layer');
  await expect(page.locator(`[data-academy-art="${section}"].is-active`)).toBeVisible();
  await expect(page.locator('#academyTeachingStage')).toBeHidden();
};

const openLessonTools=async page=>{
  await page.locator('[data-academy-action="open-lesson"]').click({force:true});
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');
  await expect(page.locator('#academyModule')).toBeVisible();
};

test('Academy opens on the approved landing and General Maritime opens as a clean art layer',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'general-maritime-education');
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
  await openLessonTools(page);
  await expect(page.locator('#academyTeachingStage')).toBeVisible();
});

test('chosen department and module are restored after a browser refresh',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'ism-isps-mlc');
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','ism-isps-mlc');
  await expect(page.locator('[data-academy-section="ism-isps-mlc"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).not.toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await expect(page.locator('#academyTeachingStage')).toHaveAttribute('data-phase','welcome');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),SELECTION_KEY);
  expect(saved).toEqual({section:'ism-isps-mlc',module:'ism-code-foundations'});
});

test('a module chosen inside a department is restored too, and the change is remembered',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'stcw');
  await openLessonTools(page);
  await page.locator('#academyModule').selectOption('marine-weather');
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','stcw');
  await expect(page.locator('[data-academy-section="stcw"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('marine-weather');
});

test('a stale or foreign saved selection falls back to the default department',async({page})=>{
  await openAcademy(page);
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'__proto__',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'stcw',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','stcw');
  await expect(page.locator('#academyModule')).toHaveValue('stcw-foundation','a module outside the department is ignored');
  await page.evaluate(key=>localStorage.setItem(key,'{not json'),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
});
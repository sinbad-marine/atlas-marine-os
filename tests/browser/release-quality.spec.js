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

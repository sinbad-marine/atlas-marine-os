'use strict';
const {test,expect}=require('@playwright/test');

const layers=[
  ['voyage-navigation','A','01-voyage-planning-A.jpg'],
  ['routes','C','02-route-library-C.jpg'],
  ['navigation-plot','C','03-navigation-plot-C.jpg'],
  ['location-intelligence','B','04-location-intelligence-B.jpg'],
  ['publications','C','05-nautical-publications-C.jpg'],
  ['resources','C','06-blue-voyage-resources-C.jpg'],
  ['enc-viewer','A','07-enc-viewer-A.jpg'],
  ['charts','B','08-local-charts-B.jpg']
];

for(const [workspace,selection,asset] of layers){
  test(`Owner-locked Voyage layer: ${workspace}`,async({page})=>{
    await page.goto(`/index.html?workspace=${workspace}`);
    await page.evaluate(()=>{localStorage.setItem('atlas_app_language','en-US');localStorage.setItem('atlas_app_language_baseline_20260919','applied');document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
    await page.waitForFunction(id=>document.getElementById(id)?.classList.contains('active'),workspace);
    await expect(page.locator('body')).toHaveAttribute('data-console-art','da-vinci');
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    const surface=page.locator(`#${workspace}`);
    await expect(surface).toBeVisible();
    if(workspace==='voyage-navigation'){
      await expect(surface).toHaveAttribute('data-owner-selections','A-C-C-B-C-C-A-B');
      await expect(surface.locator('.voyage-function-card')).toHaveCount(7);
      const sources=await surface.locator('.voyage-function-card img').evaluateAll(images=>images.map(image=>image.getAttribute('src')));
      expect(new Set(sources).size).toBe(7);
    }else{
      await expect(surface).toHaveAttribute('data-owner-selection',selection);
    }
    await expect(surface.locator(`img[src$="${asset}"]`)).toHaveCount(1);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

'use strict';
const {test,expect}=require('@playwright/test');
const contract=require('../../config/ui-design-contract.json');
const visualTest=process.platform==='win32'?test:test.skip;

const bridgeResponse=JSON.stringify({routes:0,library:{chunks:0},status:'STUDIO_RUNTIME_INCOMPLETE'});
const stabilize=async page=>{
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'});
  await page.evaluate(async()=>{
    await document.fonts.ready;
    document.querySelectorAll('img').forEach(image=>{image.style.animation='none';});
  });
  await page.waitForFunction(()=>[...document.images].filter(image=>{const style=getComputedStyle(image),box=image.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}).every(image=>image.complete&&image.naturalWidth>0),null,{timeout:10000});
};

test.beforeEach(async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:bridgeResponse}));
});

for(const [name,surface] of Object.entries(contract.surfaces)){
  test(`protected DOM contract: ${name}`,async({page})=>{
    await page.goto(surface.route);
    if(name!=='academy')await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
    if(name==='captainSinbad')await page.evaluate(()=>document.querySelector('#sinbad')?.classList.add('active'));
    for(const selector of surface.required)await expect(page.locator(selector),selector).toHaveCount(1);
    for(const selector of surface.forbidden)await expect(page.locator(selector),selector).toHaveCount(0);
  });
}

visualTest('approved PC Home Owner Overview layout',async({page,isMobile})=>{
  test.skip(isMobile,'The locked PC Home reference is desktop-only.');
  await page.goto('/index.html');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');const card=document.querySelector('#developerProjectCard');if(card)card.dataset.roleHidden='false';});
  await stabilize(page);
  await expect(page).toHaveScreenshot('dashboard-home-owner-overview.png',{fullPage:true});
});

visualTest('approved Captain Sinbad workspace layout',async({page,isMobile})=>{
  test.skip(isMobile,'The legacy stitched mobile golden is unstable when the independent Home composition changes; mobile behavior remains covered by DOM and smoke tests.');
  await page.goto('/index.html?module=sinbad');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');document.querySelector('#sinbad')?.classList.add('active');window.applyConsoleArt?.('sinbad');window.setSinbadAssistantState?.('idle',{gesture:'rest',emotion:'neutral'});});
  await stabilize(page);
  await expect(page.locator('#sinbad')).toHaveScreenshot('captain-sinbad-workspace.png');
});

visualTest('approved Academy landing and General Maritime art layer',async({page})=>{
  await page.goto('/academy.html');
  await stabilize(page);
  await expect(page.locator('.academy-landing')).toHaveScreenshot('academy-owner-landing.png');
  await page.locator('.academy-landing-hotspots [data-academy-open="general-maritime-education"]').click({force:true});
  await stabilize(page);
  await expect(page.locator('[data-academy-art="general-maritime-education"].is-active')).toHaveScreenshot('academy-general-maritime-layer.png');
});

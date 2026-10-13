const {test,expect}=require('@playwright/test');
async function observe(context,baseURL){
 const privateRequests=[];
 context.on('request',request=>{const u=new URL(request.url());if((['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.origin!==new URL(baseURL).origin)||/\/(?:functions|rest)\/v1\//.test(u.pathname)||/api\.(?:openai|anthropic)\.com/.test(u.hostname))privateRequests.push({origin:u.origin,path:u.pathname,method:request.method()});});
 // Count generated requests before containment. A rejected request still fails this test.
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(baseURL).origin?route.continue():route.abort());
 return privateRequests;
}
test('fresh visitors add remove and reload favorites without manual scope or another browser sharing them',async({page,context,browser,baseURL})=>{
 const requests=await observe(context,baseURL);
 await page.goto('/index.html');await expect(page.locator('body')).toHaveClass(/signed-out/);
 const star=()=>page.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first();
 await star().click();await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
 await expect(star()).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(star()).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sinbad_favorites_v2:')))).toEqual(['sinbad_favorites_v2:visitor']);
 const separate=await browser.newContext();try{await observe(separate,baseURL);const other=await separate.newPage();await other.goto(`${baseURL}/index.html`);await expect(other.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first()).toHaveAttribute('aria-pressed','false');expect(await other.evaluate(()=>localStorage.getItem('sinbad_favorites_v2:visitor'))).toBeNull();}finally{await separate.close();}
 await star().click();await page.getByRole('button',{name:'Remove from favorites',exact:true}).click();await page.reload();await expect(star()).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sinbad_favorites_v2:visitor')))).toEqual([]);
 expect(requests).toEqual([]);
});
test('visitor refresh and visible private actions generate zero Bridge or model requests',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL);
 await page.goto('/index.html');await expect(page.locator('body')).toHaveClass(/signed-out/);
 const refresh=page.locator('#homeCanonicalRefresh:visible,#consoleStatusRefresh:visible').first();
 if(await refresh.count())await refresh.click();
 else{
  // The approved phone visitor layout hides both refresh controls. Still test the real handler's request boundary.
  await expect(page.locator('#homeCanonicalRefresh')).toBeHidden();await expect(page.locator('#consoleStatusRefresh')).toBeHidden();
  await page.evaluate(()=>window.SinbadHome.refresh());
 }
 await expect(page.locator('#homeRefreshResult')).toHaveAttribute('data-state','unavailable');
 await page.locator('#openCaptainSignIn').click();await expect(page.locator('#authDialog')).toBeVisible();await page.locator('#closeAuthDialog').click();
 for(const workspace of ['admin-settings','engine-room','studio-console','sinbad']){
  await page.goto(`/index.html?workspace=${workspace}`);await expect(page.locator('body')).toHaveClass(/signed-out/);
  if(workspace==='sinbad'){
   await page.locator('[data-sinbad-tab="argos"]').click();await page.locator('#refreshArgosStatus').click();await expect(page.locator('#argosOverallStatus')).toHaveText('SIGN IN REQUIRED');
   await page.locator('[data-sinbad-tab="chat"]').click();const replies=page.locator('#sinbadMessages .chat-bubble.sinbad'),before=await replies.count();await page.locator('#sinbadInput').fill('Tell me about galaxies');await page.locator('#sendSinbad').click();await expect(replies).toHaveCount(before+1);
  }else for(const id of ['refreshEngineRoom','refreshStudioStatus']){const button=page.locator(`#${id}:visible`);if(await button.count()){if(id==='refreshEngineRoom'){await expect(button).toBeDisabled();await page.evaluate(()=>refreshEngineRoom());}else await button.click();}}
 }
 expect(requests).toEqual([]);
});

test('visitor Academy and native Professor cannot probe or call private AI',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL);
 await page.goto('/academy.html');
 await page.locator('.academy-landing-hotspots [data-academy-open="general-maritime-education"]').click();
 await page.locator('.academy-layer-hotspots [data-academy-scope="general-maritime-education"][data-academy-command="lesson"]').first().click();
 await page.locator('#academyQuestionInput').fill('Explain the route to the harbour');
 await page.locator('#academyQuestionInput').press('Enter');
 await expect(page.locator('#academyConversation')).toContainText('Explain the route to the harbour');
 await page.goto('/academy-professor-native.html');
 await page.locator('#academyQuestion').fill('Explain the route to the harbour');
 await page.locator('#academySend').click();
 await expect(page.locator('#academyCloudStatus')).toHaveText('Answer stopped safely');
 expect(requests).toEqual([]);
});

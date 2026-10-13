'use strict';
const {test,expect}=require('@playwright/test');
async function start(page,context,baseURL){
 const requests=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 context.on('request',request=>{if(new URL(request.url()).origin!==new URL(baseURL).origin)requests.push(request.url());});
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(baseURL).origin?route.continue():route.abort());
 await page.goto('/index.html?workspace=engine-room');await expect(page.locator('body')).toHaveClass(/signed-out/);
 await page.evaluate(()=>{appLanguage='tr-TR';window.SinbadHome.translate();});
 return {requests,errors};
}
async function authorizeFixture(page){
 await page.evaluate(()=>{
  cloudClient=null;cloudSession={user:{id:'controlled-engine-user',user_metadata:{sinbad_account_ready:true}}};
  selectedWorkspaceId='controlled-engine-workspace';currentWorkspaceRole='owner';
  currentWorkspaceRoleVerifiedScope=`${getCloudConfig().url}|${cloudSession.user.id}|${selectedWorkspaceId}`;
  setAppAccess();
 });
}
async function paintFixture(page){
 await page.evaluate(async()=>{
  await loadEngineRoomGroqRecord();
  const snapshot=normalizeEngineRoomSnapshot({},new Date().toISOString());
  window.SinbadEngineRoomRecord.compose(snapshot,[window.SinbadGroqRecord.engine(appLanguage)],{nowMs:Date.now()});
  renderEngineRoom(snapshot);
 });
}
test('first load, delayed authority, scrolling, loss of authority and history never expose private cards to visitors',async({page,context,baseURL})=>{
 const observed=await start(page,context,baseURL);
 await expect(page.locator('#refreshEngineRoom')).toBeDisabled();
 await expect(page.locator('#engineRoomObservedAt')).toHaveAttribute('data-observation-state','signin');
 // Even a late render callback cannot paint before membership is verified.
 await paintFixture(page);await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 await page.evaluate(()=>{cloudSession={user:{id:'controlled-engine-user'}};setAppAccess();});
 await expect(page.locator('#engineRoomObservedAt')).toHaveAttribute('data-observation-state','restricted');
 await paintFixture(page);await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 await authorizeFixture(page);
 await expect(page.locator('#engineRoomObservedAt')).toHaveAttribute('data-observation-state','not-requested');
 await expect(page.locator('#refreshEngineRoom')).toBeEnabled();
 await paintFixture(page);await expect(page.locator('.engine-room-card')).toHaveCount(6);
 await page.evaluate(()=>{scrollTo(0,document.body.scrollHeight);dispatchEvent(new Event('scroll'));});
 await expect(page.locator('.engine-room-card')).toHaveCount(6);
 // Real invalidation path: exactly the membership re-check that cleared the old view.
 await page.evaluate(()=>loadCurrentWorkspaceRole());
 await expect(page.locator('#engineRoomGrid')).toBeEmpty();await expect(page.locator('#refreshEngineRoom')).toBeDisabled();
 await page.evaluate(()=>{cloudSession=null;setAppAccess();});
 await page.goto('/index.html');await page.locator('#homeEngineRoomEntry').click();
 await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 await page.goBack();await page.goForward();
 await expect(page.locator('#engineRoomGrid')).toBeEmpty();await expect(page.locator('#refreshEngineRoom')).toBeDisabled();
 await page.reload();await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 expect(observed.requests).toEqual([]);expect(observed.errors).toEqual([]);
});
test('late controlled probe response is discarded after membership changes and denied refresh cannot issue requests',async({page,context,baseURL})=>{
 const observed=await start(page,context,baseURL);await authorizeFixture(page);
 await page.evaluate(()=>{
  window.fixtureProbeCalls=[];
  probeEngineRoom=path=>{window.fixtureProbeCalls.push(path);return new Promise(resolve=>{window.finishFixtureProbe=()=>resolve({ok:true,http:200,body:{observedAt:new Date().toISOString(),online:true}});});};
  window.pendingFixtureRefresh=refreshEngineRoom();
 });
 await expect(page.locator('#refreshEngineRoom')).toBeDisabled();
 await expect(page.locator('#engineRoomObservedAt')).toHaveAttribute('data-observation-state','checking');
 await page.evaluate(async()=>{invalidateMembershipAuthority();cloudSession=null;setAppAccess();window.finishFixtureProbe();await window.pendingFixtureRefresh;await refreshEngineRoom();});
 await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 expect(await page.evaluate(()=>window.fixtureProbeCalls)).toEqual(['/argos/status']);
 expect(observed.requests).toEqual([]);expect(observed.errors).toEqual([]);
});
for(const viewport of [{width:1440,height:900},{width:1100,height:390},{width:393,height:500}]){
 test(`localized compact evidence cards at ${viewport.width}x${viewport.height}`,async({page,context,baseURL},testInfo)=>{
  await page.setViewportSize(viewport);const observed=await start(page,context,baseURL);
  await page.screenshot({path:testInfo.outputPath('visitor.png'),fullPage:true});
  await authorizeFixture(page);await paintFixture(page);
  await expect(page.locator('.engine-room-card')).toHaveCount(6);
  await expect(page.locator('[data-engine-id="bridge"] header strong')).toHaveText('Veri alınamadı');
  await expect(page.locator('[data-engine-id="bridge"]')).toHaveAttribute('data-status-tone','neutral');
  await expect(page.locator('[data-engine-id="bridge"] .engine-room-time')).toHaveText('Ölçüm zamanı bildirilmedi');
  await expect(page.locator('[data-engine-id="groq-cloud"]')).toHaveAttribute('data-status-kind','old');
  await expect(page.locator('[data-engine-id="groq-cloud"] .engine-room-time')).toContainText('Kaynak kaydının okunma zamanı');
  await page.screenshot({path:testInfo.outputPath('cards.png'),fullPage:true});
  for(const lang of ['en-US','ru-RU','de-DE','ar-SA','es-ES','fr-FR','tr-TR']){
   await page.evaluate(lang=>{appLanguage=lang;window.SinbadHome.translate();},lang);
   expect(await page.locator('.engine-room-card').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth&&card.getBoundingClientRect().height<300))).toBe(true);
   await expect(page.locator('.engine-room-card header strong').first()).not.toHaveText(/UNKNOWN|UNAVAILABLE/);
   expect(await page.locator('#engine-room').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.locator('[data-engine-id="groq-cloud"] summary').click();
  await expect(page.locator('[data-engine-id="groq-cloud"] details')).toHaveAttribute('open','');
  expect(await page.locator('[data-engine-id="groq-cloud"]').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  // The adjacent short card never stretches to match an expanded long record.
  expect(await page.locator('[data-engine-id="studio"]').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(300);
  await page.screenshot({path:testInfo.outputPath('expanded-details.png'),fullPage:true});
  expect(observed.requests).toEqual([]);expect(observed.errors).toEqual([]);
 });
}
test('authorized refresh uses only five controlled responses and reenables the same read-only control',async({page,context,baseURL})=>{
 const observed=await start(page,context,baseURL);await authorizeFixture(page);
 await page.evaluate(()=>{
  window.fixtureProbeCalls=[];
  probeEngineRoom=async path=>{
   window.fixtureProbeCalls.push(path);
   if(path==='/status')return {ok:false,http:0,body:null};
   const observedAt=new Date().toISOString();
   const body=path==='/argos/status'?{observedAt,bridge:{online:true},commandGate:{active:true}}:
    path==='/ai/status'?{observedAt,online:false}:
    path==='/library/status'?{observedAt,documents:0,chunks:0}:{observedAt,status:'STUDIO_RUNTIME_INCOMPLETE'};
   return {ok:true,http:200,body};
  };
 });
 await page.locator('#refreshEngineRoom').click();
 await expect(page.locator('.engine-room-card')).toHaveCount(6);
 await expect(page.locator('#refreshEngineRoom')).toBeEnabled();
 await expect(page.locator('[data-engine-id="local-ai"] header strong')).toHaveText('Kaynak çevrimdışı bildirdi');
 await expect(page.locator('[data-engine-id="studio"] header strong')).toHaveText('Kaynak kısıt bildirdi');
 await expect(page.locator('[data-engine-id="library"] header strong')).toHaveText('Kaynak boşta bildirdi');
 expect(await page.evaluate(()=>window.fixtureProbeCalls)).toEqual(['/argos/status','/status','/library/status','/studio/status','/ai/status']);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
 await expect(page.locator('#engineRoomGrid')).toBeEmpty();
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
 await expect(page.locator('#engineRoomObservedAt')).toHaveAttribute('data-observation-state','not-requested');
 expect(await page.evaluate(()=>window.fixtureProbeCalls.length)).toBe(5);
 expect(observed.requests).toEqual([]);expect(observed.errors).toEqual([]);
});

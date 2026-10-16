'use strict';
const {test,expect}=require('@playwright/test');

for(const viewport of [{width:1440,height:900},{width:1280,height:500},{width:1100,height:390},{width:393,height:851},{width:393,height:500}]){
  test(`visible Engine Room entrance preserves private boundaries at ${viewport.width}x${viewport.height}`,async({page,context},testInfo)=>{
    await page.setViewportSize(viewport);
    const privateRequests=[];
    const isPrivate=url=>{const u=new URL(url);return (['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.port!==(new URL(testInfo.project.use.baseURL)).port)||/\/(?:functions|rest)\/v1\//.test(u.pathname)||u.hostname.endsWith('.onrender.com')||/api\.(openai|anthropic|groq)\.com/.test(u.hostname);};
    context.on('request',request=>{if(isPrivate(request.url()))privateRequests.push(request.url());});
    await context.route('**/*',route=>isPrivate(route.request().url())?route.abort():route.continue());
    await page.goto('/index.html');
    await expect(page.locator('body')).toHaveClass(/signed-out/);
    const entry=page.locator('#homeEngineRoomEntry');
    for(const [locale,label] of [['en-US','Engine Room'],['ru-RU','Машинное отделение'],['de-DE','Maschinenraum'],['ar-SA','غرفة المحركات'],['es-ES','Sala de máquinas'],['fr-FR','Salle des machines'],['tr-TR','Makine Dairesi']]){
      await page.locator('#appLanguage').selectOption(locale);
      await page.evaluate(()=>scrollTo(0,0));
      await expect(entry).toHaveText(label);
      await expect(entry).toBeInViewport({ratio:1});
      expect(await entry.evaluate(element=>{const r=element.getBoundingClientRect();return {clipped:element.scrollWidth>element.clientWidth,reachable:element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})).toEqual({clipped:false,reachable:true});
    }
    await page.screenshot({path:testInfo.outputPath('home-engine-entry.png')});
    await entry.click();
    await expect(page).toHaveURL(/\/index\.html\?workspace=engine-room$/);
    await expect(page.locator('#engine-room')).toBeVisible();
    await expect(page.locator('#engine-room')).toHaveClass(/active/);
    await expect(page.locator('#engineRoomAccessNote')).toHaveText('Özel sistem verilerini görmek için yetkili bir hesapla giriş yapın.');
    await expect(page.locator('#engineRoomGrid')).toBeEmpty();
    await expect(page.locator('#refreshEngineRoom')).toBeDisabled();
    await page.evaluate(()=>refreshEngineRoom());
    await expect(page.locator('#engineRoomGrid')).toBeEmpty();
    await page.locator('#denge-details-toggle').click();
    await page.locator('#engineRoomSignIn').click();
    await expect(page.locator('#authDialog')).toBeVisible();
    await page.locator('#closeAuthDialog').click();
    await page.screenshot({path:testInfo.outputPath('engine-room-visitor.png')});
    await page.locator('[data-window-back]').click();
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(entry).toBeVisible();
    await entry.click();
    await page.locator('[data-window-home]').click();
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(entry).toBeVisible();
    expect(privateRequests).toEqual([]);
  });
}

'use strict';
// Owner 2026-10-11 narrow UI corrections: member-only entries, favorites window bounded by the viewport, top controls clear of the hamburger menu.
const {test,expect}=require('@playwright/test');
test.beforeEach(async({context,baseURL})=>{await context.route(url=>url.origin!==new URL(baseURL).origin,route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));});
const SETTINGS='[data-open="admin-settings"],.home-hotspot-settings';
const FAVORITE_ENTRIES='.console-secondary-nav [data-console-favorites],.home-hotspot-favorites,#consoleFavoritesPanel [data-console-favorites]';
async function visitor(page){await page.goto('/index.html');await page.evaluate(()=>{document.body.classList.remove('auth-pending','authenticated');document.body.classList.add('signed-out');window.SinbadFavorites.setScope(null,null);localStorage.removeItem('sinbad_favorites_v2:visitor');window.SinbadFavorites.refresh();});}
async function member(page,count=40){
  await page.goto('/index.html');
  await page.evaluate(n=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    const ids=Object.keys(window.SinbadFavoritesCatalog||{}).slice(0,n);window.SinbadFavorites.setScope('spec-project','spec-user');
    localStorage.setItem('sinbad_favorites_v2:spec-project:spec-user',JSON.stringify(ids));window.SinbadFavorites.refresh();},count);
}
const box=async(loc)=>loc.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};});
const intersects=(a,b)=>a&&b&&!(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y);
const VIEWS=[{name:'desktop',width:1440,height:900},{name:'short',width:1280,height:500},{name:'landscape',width:844,height:390},{name:'phone',width:390,height:844}];
const stored=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);

for(const v of VIEWS)test(`visitor sees no Settings entry and cannot focus one, keeps the language select, and can open the favorites window at ${v.name}`,async({page})=>{
  await page.setViewportSize({width:v.width,height:v.height});await visitor(page);
  for(const el of await page.locator(SETTINGS).all())await expect(el).toBeHidden();
  const reached=[];for(let i=0;i<120;i++){await page.keyboard.press('Tab');const hit=await page.evaluate(sel=>{const a=document.activeElement;return a&&a!==document.body&&a.matches(sel)?a.outerHTML.slice(0,60):'';},SETTINGS);if(hit)reached.push(hit);}
  expect(reached).toEqual([]);
  await expect(page.locator('#publicGateway #openCaptainSignIn')).toBeVisible();await expect(page.locator('#publicGateway #openRegistration')).toBeVisible();
  await expect(page.locator(v.width>=1100?'#appLanguage':'#publicAppLanguage')).toBeVisible();
  await expect(page.locator('#consoleFavoritesPanel [data-console-favorites]')).toBeVisible();
  await expect(page.locator('.sinbad-favorite-star').first()).toBeAttached();
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
  await expect(page.locator('#consoleFavoritesOptions')).toContainText('No favorites yet');
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeHidden();
  await expect(page.locator('[data-owner-console]').first()).toBeHidden();await expect(page.locator('#humanReviewEntry')).toBeHidden();
});

test('visitor adds and removes a favorite without signing in, through the star and through the window',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await visitor(page);
  const star=page.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first();
  await star.click();await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
  await expect(star).toHaveAttribute('aria-pressed','true');expect(await stored(page,'sinbad_favorites_v2:visitor')).toEqual(['workspace:yacht-operations']);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  const row=page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:yacht-operations"]');await expect(row).toBeVisible();
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeHidden();
  await star.click();await page.getByRole('button',{name:'Remove from favorites',exact:true}).click();
  await expect(star).toHaveAttribute('aria-pressed','false');expect(await stored(page,'sinbad_favorites_v2:visitor')).toEqual([]);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesOptions [data-favorite-open]')).toHaveCount(0);await expect(page.locator('#consoleFavoritesOptions')).toContainText('No favorites yet');
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sinbad_favorites_v2:')&&k!=='sinbad_favorites_v2:visitor'))).toEqual([]);
});

test('every visible favorites entry opens the same single window by a real pointer click, and no list grows under the page',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await visitor(page);
  await page.evaluate(()=>{localStorage.setItem('sinbad_favorites_v2:visitor',JSON.stringify(Object.keys(window.SinbadFavoritesCatalog).slice(0,30)));window.SinbadFavorites.refresh();});
  const centreHits=async(loc)=>loc.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);});
  for(const sel of ['.home-hotspot-favorites','#consoleFavoritesPanel [data-console-favorites]']){
    const loc=page.locator(sel);await expect(loc).toBeVisible();expect(await centreHits(loc)).toBe(true);
    await loc.click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
    await expect(page.locator('#consoleFavoritesOptions [data-favorite-open]')).toHaveCount(30);
    expect(await page.evaluate(()=>document.querySelectorAll('dialog[open]').length)).toBe(1);
    await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeHidden();
  }
  // the sidebar's covered duplicates are out of the flow in this layout: not visible, not reachable by Tab
  for(const sel of ['.console-secondary-nav [data-console-favorites]','.console-secondary-nav [data-open="admin-settings"]'])await expect(page.locator(sel)).toBeHidden();
  const reached=[];for(let i=0;i<120;i++){await page.keyboard.press('Tab');const hit=await page.evaluate(()=>{const a=document.activeElement;return a&&a.closest('.console-secondary-nav')?a.outerHTML.slice(0,50):'';});if(hit)reached.push(hit);}
  expect(reached).toEqual([]);
  expect(await page.evaluate(()=>getComputedStyle(document.getElementById('consoleFavoritesList')).display)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
});

test('member Settings entry opens the settings workspace by a real pointer click; the visitor has no Settings entry',async({page,context})=>{
  await page.setViewportSize({width:1440,height:900});await member(page,0);
  const settings=page.locator('.home-hotspot-settings');await expect(settings).toBeVisible();
  expect(await settings.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);})).toBe(true);
  const opened=context.waitForEvent('page');await settings.click();const child=await opened;await child.waitForURL(/workspace=admin-settings$/);await child.close();
  const favorites=page.locator('.home-hotspot-favorites');await favorites.click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();
  await page.evaluate(()=>{cloudSession=null;setAppAccess();window.SinbadFavorites.setScope(null,null);});
  await expect(page.locator('body')).toHaveClass(/signed-out/);
  for(const el of await page.locator(SETTINGS).all())await expect(el).toBeHidden();
  await expect(page.locator('.home-hotspot-favorites')).toBeVisible();
});

test('visitor favorites and member favorites stay separate across sign-in and sign-out',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await visitor(page);
  await page.evaluate(()=>{localStorage.setItem('sinbad_favorites_v2:visitor',JSON.stringify(['workspace:yacht-operations']));window.SinbadFavorites.refresh();});
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  await expect(page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:yacht-operations"]')).toBeVisible();
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();
  // sign in: the member list starts from the member's own key, nothing is merged in
  await page.evaluate(()=>{cloudSession={user:{id:'spec-user',user_metadata:{sinbad_account_ready:true}}};setAppAccess();window.SinbadFavorites.setScope('spec-project','spec-user');});
  await expect(page.locator('body')).toHaveClass(/authenticated/);
  expect(await stored(page,'sinbad_favorites_v2:spec-project:spec-user')).toEqual([]);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  await expect(page.locator('#consoleFavoritesOptions [data-favorite-open]')).toHaveCount(0);
  await page.locator('#consoleFavoritesDialog button[value="cancel"]').click();
  await page.locator('.sinbad-favorite-star[data-favorite-id="workspace:voyage-navigation"]').first().click();await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
  expect(await stored(page,'sinbad_favorites_v2:spec-project:spec-user')).toEqual(['workspace:voyage-navigation']);
  expect(await stored(page,'sinbad_favorites_v2:visitor')).toEqual(['workspace:yacht-operations']);
  // sign out: the window closes, the member list is not shown to the visitor, the visitor list is back
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
  await page.evaluate(()=>{cloudSession=null;setAppAccess();window.SinbadFavorites.setScope(null,null);});
  await expect(page.locator('#consoleFavoritesDialog')).toBeHidden();await expect(page.locator('body')).toHaveClass(/signed-out/);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  await expect(page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:yacht-operations"]')).toBeVisible();
  await expect(page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:voyage-navigation"]')).toHaveCount(0);
  expect(await stored(page,'sinbad_favorites_v2:spec-project:spec-user')).toEqual(['workspace:voyage-navigation']);
});

test('sign-out closes the favorites window and the settings workspace and hides the entries',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await member(page,6);
  // A real session object drives setAppAccess (the presentation class alone is not a session); then the session is lost.
  await page.evaluate(()=>{cloudSession={user:{id:'spec-user',user_metadata:{sinbad_account_ready:true}}};setAppAccess();});
  await expect(page.locator('body')).toHaveClass(/authenticated/);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
  await page.evaluate(()=>{cloudSession=null;setAppAccess();});
  await expect(page.locator('#consoleFavoritesDialog')).toBeHidden();await expect(page.locator('body')).toHaveClass(/signed-out/);
  for(const el of await page.locator(SETTINGS).all())await expect(el).toBeHidden();
  await expect(page.locator('#consoleFavoritesPanel [data-console-favorites]')).toBeVisible();
  await page.evaluate(()=>{cloudSession={user:{id:'spec-user',user_metadata:{sinbad_account_ready:true}}};setAppAccess();document.getElementById('admin-settings').classList.add('active');});
  await page.evaluate(()=>{cloudSession=null;setAppAccess();});
  await expect(page.locator('#admin-settings')).not.toHaveClass(/active/);
  // A presentation-only class without a session (as other specs simulate) does not count as a sign-out and must not close anything.
  await page.evaluate(()=>{document.body.classList.remove('signed-out');document.body.classList.add('authenticated');document.getElementById('admin-settings').classList.add('active');});
  await page.evaluate(()=>{cloudSession=null;setAppAccess();});
  await expect(page.locator('#admin-settings')).toHaveClass(/active/);
});

for(const v of VIEWS)test(`favorites window fits the viewport, keeps Close reachable and scrolls its long list to the last item at ${v.name}`,async({page,isMobile})=>{
  await page.setViewportSize({width:v.width,height:v.height});await member(page,40);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  const dialog=page.locator('#consoleFavoritesDialog');await expect(dialog).toBeVisible();
  const d=await box(dialog);expect(d.y).toBeGreaterThanOrEqual(0);expect(d.bottom).toBeLessThanOrEqual(v.height);
  const close=dialog.locator('header button[value="cancel"]'),done=dialog.locator('button[value="done"]'),options=page.locator('#consoleFavoritesOptions');
  for(const loc of [close,done]){const b=await box(loc);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(v.height);expect(await loc.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);})).toBe(true);}
  expect(await options.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  expect(await page.evaluate(()=>document.getElementById('consoleFavoritesList')&&getComputedStyle(document.getElementById('consoleFavoritesList')).display)).toBe('none');
  const rows=options.locator('[data-favorite-open]');await expect(rows).toHaveCount(40);
  const last=rows.last();
  if(isMobile){const o=await box(options);const steps=12;for(let i=0;i<steps;i++){const cdp=await page.context().newCDPSession(page);const x=o.x+o.w/2,y0=o.y+o.h*0.8,y1=o.y+o.h*0.2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(60);}}
  else{await options.hover({position:{x:12,y:12}});for(let i=0;i<10;i++)await page.mouse.wheel(0,600);}
  await expect.poll(()=>last.evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0;})).toBe(true);
  const header=await box(close);expect(header.y).toBeGreaterThanOrEqual(0);expect(header.bottom).toBeLessThanOrEqual(v.height);
  const lastBox=await box(last);expect(await last.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+Math.min(12,r.height/2));return hit===e||e.contains(hit);})).toBe(true);expect(lastBox.bottom).toBeLessThanOrEqual(v.height);
  const opener=page.locator('#consoleFavoritesPanel [data-console-favorites]');
  await close.click();await expect(dialog).toBeHidden();
  expect(await page.evaluate(()=>document.activeElement?.hasAttribute('data-console-favorites')||document.activeElement===document.body)).toBe(true);
  await expect(opener).toBeVisible();
});

test('a favorite row inside the window still opens its page on double-click and Enter, not on a single click',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await member(page,3);
  await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();
  const row=page.locator('#consoleFavoritesOptions [data-favorite-open]').first();await expect(row).toBeVisible();
  await row.click();await page.waitForTimeout(300);expect(page.context().pages()).toHaveLength(1);
  const opened=page.waitForEvent('popup');await row.dblclick();const child=await opened;await child.waitForURL(/workspace=|academy\.html|store\//);await child.close();
  await row.focus();const second=page.waitForEvent('popup');await row.press('Enter');const child2=await second;await child2.close();
  expect(page.context().pages()).toHaveLength(1);
});

for(const v of VIEWS.filter(x=>x.width>=1100))test(`language and account box stay clear of the hamburger and of the open quick-actions menu at ${v.name}`,async({page})=>{
  await page.setViewportSize({width:v.width,height:v.height});await member(page,0);
  const account=page.locator('.topbar-account-actions'),hamburger=page.locator('#homeCanonicalMenu'),summary=page.locator('.hero-action-menu>summary'),refresh=page.locator('#homeCanonicalRefresh');
  await expect(account).toBeVisible();await expect(page.locator('#appLanguage')).toBeVisible();await expect(page.locator('#openAccountPassword')).toBeVisible();
  let a=await box(account);expect(a.y).toBeGreaterThanOrEqual(0);expect(a.right).toBeLessThanOrEqual(v.width);
  // Only user-facing controls count: the <summary> is an invisible, pointer-events:none proxy in this layout.
  for(const loc of [hamburger,summary,refresh]){if(await loc.count()&&await loc.isVisible()&&await loc.evaluate(e=>{const cs=getComputedStyle(e);return cs.opacity!=='0'&&cs.pointerEvents!=='none';}))expect(intersects(a,await box(loc))).toBe(false);}
  await page.evaluate(()=>{document.body.classList.add('member-verified');for(const id of ['ownerConsoleEntry','communicationAppEntry']){const b=document.getElementById(id);if(b){b.hidden=false;b.removeAttribute('hidden');}}});
  await expect.poll(async()=>{const current=await box(account);return intersects(current,await box(page.locator('.console-statusbar')));}).toBe(false);
  a=await box(account);
  console.log('HOME_CONTROL_GEOMETRY',JSON.stringify({viewport:page.viewportSize(),account:a,status:await box(page.locator('.console-statusbar'))}));
  for(const sel of ['.console-statusbar','#ownerConsoleEntry','#communicationAppEntry']){const loc=page.locator(sel);if(await loc.count()&&await loc.isVisible()){expect(intersects(a,await box(loc))).toBe(false);if(sel!=='.console-statusbar')expect(await loc.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);})).toBe(true);}}
  expect(await page.locator('#appLanguage').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
  await hamburger.click();await expect(page.locator('.hero-action-menu')).toHaveAttribute('open','');
  const panel=await box(page.locator('.hero-action-menu .action-menu-panel'));expect(intersects(a,panel)).toBe(false);
  for(const option of await page.locator('.hero-action-menu .action-menu-panel button').all()){expect(intersects(a,await box(option))).toBe(false);expect(await option.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);})).toBe(true);}
  await hamburger.click();await expect(page.locator('.hero-action-menu')).not.toHaveAttribute('open','');
  expect(await page.locator('#openAccountPassword').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
});

// Exercise the narrow desktop boundary and longer translations on both platforms.
for(const width of [1100,1180,1280])for(const height of [390,500])test(`short Home controls remain separated across languages and restore position at ${width}x${height}`,async({page})=>{
  await member(page,0);
  await page.evaluate(()=>{document.body.classList.add('member-verified');for(const id of ['ownerConsoleEntry','communicationAppEntry'])document.getElementById(id).hidden=false;});
  const account=page.locator('.topbar-account-actions'),bar=page.locator('.console-statusbar');
  await page.setViewportSize({width,height});
    for(const locale of ['en-US','tr-TR','ru-RU','de-DE','ar-SA','es-ES','fr-FR']){
      await page.locator('#appLanguage').selectOption(locale);
      await expect.poll(async()=>intersects(await box(account),await box(bar))).toBe(false);
      const a=await box(account);expect(a.y).toBeGreaterThanOrEqual(0);expect(a.bottom).toBeLessThanOrEqual(height);
      for(const id of ['appLanguage','openAccountPassword'])expect(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
      await page.locator('#homeCanonicalMenu').click();
      const menu=page.locator('.hero-action-menu .action-menu-panel');await expect(menu).toBeVisible();
      await expect.poll(async()=>intersects(await box(account),await box(menu))).toBe(false);
      const m=await box(menu);expect(m.bottom).toBeLessThanOrEqual(height);expect(m.y).toBeGreaterThanOrEqual(a.bottom);
      await menu.locator('button').last().scrollIntoViewIfNeeded();await expect(menu.locator('button').last()).toBeInViewport();
      await page.locator('#homeCanonicalMenu').click();
    }
  await page.setViewportSize({width:1440,height:900});await page.locator('#appLanguage').selectOption('en-US');
  await expect.poll(()=>account.evaluate(el=>el.getBoundingClientRect().top)).toBe(63);
  await page.setViewportSize({width:390,height:844});await expect.poll(()=>account.evaluate(el=>el.style.top)).toBe('');
});

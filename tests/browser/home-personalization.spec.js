const {test,expect}=require('@playwright/test');
async function blocked(page){await page.context().route('**/*',route=>{const url=new URL(route.request().url());return url.origin===new URL(test.info().project.use.baseURL||'http://127.0.0.1:4291').origin||['127.0.0.1','localhost'].includes(url.hostname)&&url.port===new URL(page.url().startsWith('http')?page.url():'http://127.0.0.1:4291').port?route.continue():route.fulfill({status:503,body:'{}'});});}
async function home(page){await blocked(page);await page.goto('/index.html');await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated','member-verified');});}
for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844}]){
 test(`Home TR/EN, real refresh unavailable state and full painted card bounds ${viewport.width}`,async({page})=>{await page.setViewportSize(viewport);await home(page);await expect(page.locator('#appLanguage')).toBeVisible();expect(await page.locator('#appLanguage').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);await page.locator('#appLanguage').click();await page.keyboard.press('Escape');await page.locator('#appLanguage').selectOption('tr-TR');await expect(page.locator('.card-yacht h3')).toHaveText('Yat Yönetimi');await expect(page.locator('#consoleFavoritesPanel h3')).toHaveText('Favoriler');await expect(page.locator('[data-console-status="local"] small')).toHaveText('DOĞRULANMADI');await page.locator(viewport.width>=1100?'#homeCanonicalRefresh':'#consoleStatusRefresh').click();await expect(page.locator('#homeRefreshResult')).toContainText('giriş yapıp');await expect(page.locator('#consoleStatusChecked')).toBeHidden();await expect(page.locator('[data-console-status="cloud"]')).not.toHaveAttribute('data-state','ready');await page.locator('#appLanguage').selectOption('en-US');await expect(page.locator('.card-yacht p')).toHaveText('Fleet · Crew · Logbook · Media');await expect(page.locator('#consoleFavoritesPanel h3')).toHaveText('Favorites');
  if(viewport.width>=1100){for(const card of ['.card-yacht','.card-voyage','.card-academy']){const rect=await page.locator(card).boundingBox();expect(rect.height).toBeGreaterThan(250);}}
  const cards=page.locator('.console-domain-card');for(let i=0;i<7;i++){const card=cards.nth(i);await card.scrollIntoViewIfNeeded();await expect.poll(()=>card.evaluate(el=>{const r=el.getBoundingClientRect();return [.18,.5,.9].every(y=>{const hit=document.elementFromPoint(r.left+r.width*.45,r.top+r.height*y);return hit===el||el.contains(hit);});})).toBe(true);}
  await expect(page.locator('#consoleRecentPanel')).toHaveCount(0);await expect(page.locator('.console-dock-actions [data-open="routes"]')).toBeHidden();await expect(page.locator('.console-dock-actions [data-open="cloud-documents"]')).toBeHidden();
 });
}
test('Home stars are independent, keyboard focusable, and visitors write only their own browser-local favorites',async({page})=>{await home(page);await page.evaluate(()=>{document.body.classList.remove('authenticated');document.body.classList.add('signed-out');SinbadFavorites.setScope(null,null);});const star=page.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first();await star.focus();await star.press('Enter');await expect(page.locator('.sinbad-favorite-popover')).toBeVisible();await expect(page.locator('.sinbad-favorite-popover')).not.toContainText('Sign in');await expect(page.locator('.sinbad-favorite-popover button').first()).toBeEnabled();await page.getByRole('button',{name:'Add to favorites',exact:true}).click();await expect(star).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sinbad_favorites_v2:visitor')||'[]'))).toContain('workspace:yacht-operations');expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sinbad_favorites_v2:')&&k!=='sinbad_favorites_v2:visitor'))).toEqual([]);expect(page.context().pages()).toHaveLength(1);await star.press('Enter');await page.keyboard.press('Escape');await expect(star).toBeFocused();});
test('isolated favorites module fixture shares canonical state, keyboard/touch actions, locale and logout',async({page})=>{
 await blocked(page);await page.route('**/__favorites_fixture.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><link rel="stylesheet" href="/sinbad-favorites.css"><style>button.target{display:block;width:300px;height:120px;margin:60px}</style><button class="target" id="first">Fleet card</button><button class="target" id="second">Same fleet destination</button><div data-favorites-list></div><script src="/sinbad-favorites-catalog.js"></script><script src="/sinbad-favorites.js"></script>`}));await page.goto('/__favorites_fixture.html');await page.evaluate(()=>{SinbadFavorites.setScope('unit-project','synthetic-user-a');SinbadFavorites.decorate(document.getElementById('first'),'workspace:fleet');SinbadFavorites.decorate(document.getElementById('second'),'workspace:fleet');});
 await page.locator('.sinbad-favorite-star').first().click();await page.getByRole('button',{name:'Add to favorites',exact:true}).click();await expect(page.locator('[data-favorite-open]')).toHaveCount(1);await expect(page.locator('.sinbad-favorite-star[aria-pressed="true"]')).toHaveCount(2);await page.evaluate(()=>SinbadFavorites.setLanguage('tr-TR'));await expect(page.locator('[data-favorite-open]')).toHaveText('Filo ve Yat Yönetimi');await page.evaluate(()=>SinbadFavorites.setScope('unit-project','synthetic-user-b'));await expect(page.locator('[data-favorite-open]')).toHaveCount(0);await page.evaluate(()=>SinbadFavorites.setScope('unit-project','synthetic-user-a'));await expect(page.locator('[data-favorite-open]')).toHaveCount(1);await expect(page.locator('[data-favorite-remove]')).toHaveCount(0);await page.locator('.sinbad-favorite-star').first().click();await page.getByRole('button',{name:'Favorilerden çıkar',exact:true}).click();await expect(page.locator('[data-favorite-open]')).toHaveCount(0);await page.evaluate(()=>SinbadFavorites.setScope(null,null));await expect(page.locator('[data-favorites-list]')).toContainText('Henüz favori yok');await expect(page.locator('[data-favorite-open]')).toHaveCount(0);
});
test('Academy subject favorites restore passive selection, history and invalid ID safely',async({page})=>{await blocked(page);await page.goto('/academy.html?favorite=academy%3Asubject%3ASVZ%3A01');await expect(page.locator('.gasm-qualification[data-qualification-code="SVZ"]')).toHaveAttribute('open','');await expect(page.locator('.gasm-subject-button[data-qualification-code="SVZ"][data-subject-code="01"]')).toHaveClass(/active/);await expect(page.locator('.gasm-question-card')).toHaveCount(0);expect(await page.evaluate(()=>academyLessonClockTimer)).toBeNull();
 await page.evaluate(()=>SinbadAcademyFavorites.restore('academy:layer:stcw'));await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','layer');await page.goBack();await expect(page.locator('.gasm-subject-button[data-qualification-code="SVZ"][data-subject-code="01"]')).toHaveClass(/active/);await page.goForward();await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','stcw');await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','layer');await page.goto('/academy.html?favorite=__proto__');await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','landing');await expect(page.locator('.gasm-question-card')).toHaveCount(0);
});
test('all registered Academy qualification/subject destinations select without starting questions or clocks',async({page})=>{await blocked(page);await page.goto('/academy.html');const result=await page.evaluate(()=>{const errors=[];const ids=Object.keys(SinbadFavoritesCatalog).filter(id=>id.startsWith('academy:qualification:')||id.startsWith('academy:subject:'));for(const id of ids){const item=SinbadFavoritesCatalog[id];if(!SinbadAcademyFavorites.restore(id)||document.querySelector('.gasm-question-card')||academyLessonClockTimer!==null)errors.push(id);const detail=document.querySelector('.gasm-qualification[open]');if(detail?.dataset.qualificationCode!==(item.qualification||item.code))errors.push(id+':selection');}return {count:ids.length,errors};});expect(result.count).toBe(135);expect(result.errors).toEqual([]);});
test('Captain favorites commit exact tab URL and restore Back/Forward/reload',async({page})=>{await blocked(page);await page.goto('/index.html?workspace=sinbad&tab=argos');await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');SinbadFavorites.open('captain:tab:chat');});await expect(page).toHaveURL(/tab=chat/);await expect(page.locator('#sinbad-tab-chat')).toHaveAttribute('aria-selected','true');await page.reload();await expect(page.locator('#sinbad-tab-chat')).toHaveAttribute('aria-selected','true');await page.evaluate(()=>SinbadFavorites.open('captain:tab:academy'));await expect(page).toHaveURL(/tab=academy/);await page.goBack();await expect(page.locator('#sinbad-tab-chat')).toHaveAttribute('aria-selected','true');await page.goForward();await expect(page.locator('#sinbad-tab-academy')).toHaveAttribute('aria-selected','true');});
test('Academy favorite change persists exact nested target after reload and normal layer navigation clears stale favorite',async({page})=>{await blocked(page);await page.goto('/academy.html?favorite=academy%3Asubject%3ASVZ%3A01');await page.evaluate(()=>SinbadFavorites.open('academy:module:stcw:stcw-foundation'));await expect(page).toHaveURL(/favorite=academy%3Amodule%3Astcw%3Astcw-foundation/);await page.reload();await expect(page.locator('#academyModule')).toHaveValue('stcw-foundation');await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');await page.evaluate(()=>openAcademyLayerTool(document.querySelector('[data-academy-scope="stcw"][data-academy-command="back-academy"]')));await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','landing');await expect(page).not.toHaveURL(/favorite=/);await page.evaluate(()=>showStandaloneAcademyLayer('professor-sinbad'));await page.goBack();await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','landing');});
test('whole Home card opens once from bottom and keyboard; stars stay separate and reduced motion is honored',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:900});await home(page);const card=page.locator('.card-yacht'),box=await card.boundingBox();const popupPromise=page.waitForEvent('popup');await page.mouse.click(box.x+box.width*.45,box.y+box.height*.9);const child=await popupPromise;await child.waitForURL(/workspace=yacht-operations/);expect(page.context().pages()).toHaveLength(2);await child.close();await card.focus();const keyboardPopup=page.waitForEvent('popup');await card.press('Enter');const second=await keyboardPopup;await second.waitForURL(/workspace=yacht-operations/);await second.close();await card.hover();expect(await card.evaluate(el=>getComputedStyle(el).transform)).toBe('none');});

test('dropdown-only Academy module targets expose a canonical star without starting lessons',async({page})=>{await blocked(page);await page.goto('/academy.html');for(const [section,module]of [['stcw','electronic-navigation'],['stcw','marine-weather'],['general-maritime-education','general-maritime-education']]){await page.evaluate(section=>{selectAcademySection(section);document.querySelector('.academy-shell').dataset.academyView='tools';},section);await page.locator('#academyModule').selectOption(module);await page.locator('#academyModule').scrollIntoViewIfNeeded();await expect(page.locator(`.sinbad-favorite-star[data-favorite-id="academy:module:${section}:${module}"]`).last()).toBeVisible();expect(await page.evaluate(()=>academyLessonClockTimer)).toBeNull();}});
test('Academy favorite hydration and reload do not create phantom history entries',async({page})=>{await blocked(page);await page.goto('/index.html');await page.goto('/academy.html?favorite=academy%3Asubject%3ASVZ%3A01');const firstLength=await page.evaluate(()=>history.length);await page.reload();expect(await page.evaluate(()=>history.length)).toBe(firstLength);await page.goBack();await expect(page).toHaveURL(/\/index\.html$/);await page.goForward();await expect(page.locator('.gasm-subject-button[data-qualification-code="SVZ"][data-subject-code="01"]')).toHaveClass(/active/);await page.evaluate(()=>SinbadFavorites.open('academy:module:stcw:stcw-foundation'));const secondLength=await page.evaluate(()=>history.length);await page.reload();expect(await page.evaluate(()=>history.length)).toBe(secondLength);await page.goBack();await expect(page.locator('.gasm-subject-button[data-qualification-code="SVZ"][data-subject-code="01"]')).toHaveClass(/active/);await expect(page.locator('.gasm-question-card')).toHaveCount(0);});
for(const width of [320,390,820])test(`Home quick actions fit the visible viewport at ${width}px`,async({page})=>{await page.setViewportSize({width,height:844});await home(page);await page.locator('#appLanguage').selectOption('tr-TR');const summary=page.locator('.hero-action-menu>summary');await expect(summary.locator('span')).toHaveText('☰');await summary.click();const panel=page.locator('.hero-action-menu .action-menu-panel');await expect(panel).toBeVisible();const r=await panel.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.locator('.hero-action-menu [data-open="captains-logbook"]').scrollIntoViewIfNeeded();await expect.poll(()=>page.locator('.hero-action-menu [data-open="captains-logbook"]').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBe(true);await summary.click();await expect(panel).toBeHidden();});

test('scrolled Academy subject, qualification and family stars remain reachable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await blocked(page);await page.goto('/academy.html');
 for(const item of [
  {id:'academy:subject:SK:07',target:'.gasm-subject-button[data-qualification-code="SK"][data-subject-code="07"]'},
  {id:'academy:qualification:UK',target:'.gasm-qualification[data-qualification-code="UK"]>summary'},
  {id:'academy:family:engine',target:'[data-gasm-family="engine"]'}
 ]){
  await page.evaluate(id=>SinbadAcademyFavorites.restore(id),item.id);
  const target=page.locator(item.target);await target.scrollIntoViewIfNeeded();
  await target.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.top-300);});
  const star=page.locator(`.sinbad-favorite-star[data-favorite-id="${item.id}"]`).last();
  await expect(star).toBeVisible();await star.click();await expect(page.locator('.sinbad-favorite-popover')).toBeVisible();
  await expect(page.locator('.gasm-question-card')).toHaveCount(0);await page.keyboard.press('Escape');
 }
});
for(const width of [390,820,1440])test(`standalone page favorites have readable independent touch targets at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await blocked(page);
 for(const [path,id,targetSelector]of [['/store/index.html','workspace:store','main h1'],['/academy-professor-native.html','page:academy-professor-native.html','.native-brand']]){
  await page.goto(path);const target=page.locator(targetSelector);await target.scrollIntoViewIfNeeded();
  const star=page.locator(`.sinbad-favorite-star[data-favorite-id="${id}"]`);await expect(star).toBeVisible();
  const box=await star.boundingBox();expect(box.width).toBe(44);expect(box.height).toBe(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  const overlap=await target.evaluate((el,starBox)=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;const rects=[];while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);rects.push(...range.getClientRects());}return rects.some(r=>Math.min(r.right,starBox.x+starBox.width)-Math.max(r.left,starBox.x)>1&&Math.min(r.bottom,starBox.y+starBox.height)-Math.max(r.top,starBox.y)>1);},box);expect(overlap).toBe(false);
  const before=page.url();await star.click();await expect(page.locator('.sinbad-favorite-popover')).toBeVisible();expect(page.url()).toBe(before);await page.keyboard.press('Escape');await expect(star).toBeFocused();
 }
});
test('favorite stars respect actual scroll-container clipping',async({page})=>{
 await blocked(page);await page.route('**/__clip_fixture.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><link rel="stylesheet" href="/sinbad-favorites.css"><style>#clip{height:120px;width:300px;overflow:auto;margin:40px}#spacer{height:180px}#target{width:280px;height:90px}</style><div id="clip"><div id="spacer"></div><button id="target">Saved route</button></div><script src="/sinbad-favorites-catalog.js"></script><script src="/sinbad-favorites.js"></script>`}));
 await page.goto('/__clip_fixture.html');await page.evaluate(()=>SinbadFavorites.decorate(document.getElementById('target'),'workspace:fleet'));const star=page.locator('.sinbad-favorite-star');await expect(star).toBeHidden();await page.locator('#clip').evaluate(el=>el.scrollTop=180);await expect(star).toBeVisible();await star.click();await expect(page.locator('.sinbad-favorite-popover')).toBeVisible();
});
test('desktop Home control accessible names follow the visible TR/EN labels',async({page})=>{await page.setViewportSize({width:1440,height:900});await home(page);for(const [locale,settings,quick]of [['tr-TR','Ayarlar','Hızlı işlemler'],['en-US','Settings','Quick actions']]){await page.locator('#appLanguage').selectOption(locale);await expect(page.locator('.home-hotspot-settings')).toHaveAccessibleName(settings);await expect(page.locator('#homeCanonicalMenu')).toHaveAccessibleName(quick);}});
test('seven dashboard languages persist and do not mix the home cards',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await home(page);
 const samples=[
  ['en-US','ltr','Yacht Management','Fleet · Crew · Logbook · Media'],
  ['tr-TR','ltr','Yat Yönetimi','Filo · Mürettebat · Seyir Defteri · Medya'],
  ['ru-RU','ltr','Управление яхтой','Флот · Экипаж · Журнал · Медиа'],
  ['de-DE','ltr','Yachtverwaltung','Flotte · Besatzung · Tagebuch · Medien'],
  ['ar-SA','rtl','إدارة اليخوت','الأسطول · الطاقم · السجل · الوسائط'],
  ['es-ES','ltr','Gestión de yates','Flota · Tripulación · Diario · Medios'],
  ['fr-FR','ltr','Gestion du yacht','Flotte · Équipage · Journal · Médias']
 ];
 for(const [locale,dir,title,copy] of samples){
  await page.locator('#appLanguage').selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('dir',dir);
  await expect(page.locator('html')).toHaveAttribute('lang',locale.split('-')[0]);
  await expect(page.locator('.card-yacht h3')).toHaveText(title);
  await expect(page.locator('.card-yacht p')).toHaveText(copy);
  await page.reload();
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  await expect(page.locator('#appLanguage')).toHaveValue(locale);
  await expect(page.locator('.card-yacht h3')).toHaveText(title);
 }
 await page.locator('#appLanguage').selectOption('de-DE');
 const card=page.locator('.card-documents'),title=card.locator('h3');
 await expect(title).toHaveText('Dokumente und Einhaltung der Vorschriften');
 expect(await title.evaluate(el=>{const t=el.getBoundingClientRect(),c=el.closest('.console-domain-card').getBoundingClientRect();return t.width>0&&t.left>=c.left-1&&t.right<=c.right+1&&t.top>=c.top-1&&t.bottom<=c.bottom+1;})).toBe(true);
});
test('favorite list opens once on double-click and Enter, not on a single click',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await home(page);
 await page.evaluate(()=>SinbadFavorites.setScope('unit-project','synthetic-user-a'));
 await page.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first().click();
 await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
 await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
 const row=page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:yacht-operations"]');
 await expect(row).toBeVisible();
 await row.click();
 await page.waitForTimeout(300);
 expect(page.context().pages()).toHaveLength(1);
 const first=page.waitForEvent('popup');
 await row.dblclick();
 const child=await first;await child.waitForURL(/yacht-operations/);await child.close();
 await row.focus();
 const second=page.waitForEvent('popup');
 await row.press('Enter');
 const child2=await second;await child2.waitForURL(/yacht-operations/);await child2.close();
 expect(page.context().pages()).toHaveLength(1);
});
test('phone double-tap opens one favorite page and a drag does not',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile-chromium','Desktop Chromium has hasTouch=false, so touchscreen.tap is not a product failure on that project. Mouse double-click is covered by the desktop favorite test.');
 await page.setViewportSize({width:390,height:844});await home(page);
 await page.evaluate(()=>SinbadFavorites.setScope('unit-project','synthetic-user-touch'));
 const yacht=page.locator('.card-yacht');await yacht.scrollIntoViewIfNeeded();
 await page.locator('.sinbad-favorite-star[data-favorite-id="workspace:yacht-operations"]').first().click();
 await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
 await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
 const row=page.locator('#consoleFavoritesOptions [data-favorite-open="workspace:yacht-operations"]');
 await row.scrollIntoViewIfNeeded();
 expect(await row.evaluate(el=>getComputedStyle(el).touchAction)).toBe('manipulation');
 const box=await row.boundingBox();
 await page.touchscreen.tap(box.x+box.width/2,box.y+12);
 await page.waitForTimeout(280);
 expect(page.context().pages()).toHaveLength(1);
 await row.dispatchEvent('pointerdown',{pointerType:'touch',clientX:box.x+8,clientY:box.y+12,button:0});
 await row.dispatchEvent('pointerup',{pointerType:'touch',clientX:box.x+36,clientY:box.y+12,button:0});
 await page.waitForTimeout(200);
 expect(page.context().pages()).toHaveLength(1);
 const opened=page.waitForEvent('popup');
 await page.touchscreen.tap(box.x+box.width/2,box.y+12);
 await page.touchscreen.tap(box.x+box.width/2,box.y+12);
 const child=await opened;await child.waitForURL(/yacht-operations/);
 expect(page.context().pages()).toHaveLength(2);
 await child.close();
});
test('ARGOS star saves the ARGOS tab, a single click does not open it, and Home returns to that favorite',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await blocked(page);
 await page.goto('/index.html?workspace=sinbad');
 await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');SinbadFavorites.setScope('unit-project','synthetic-user-argos');});
 const targets=await page.locator('[data-target-tab="argos"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.favoriteTarget));
 expect(targets.length).toBeGreaterThan(0);
 expect(targets.every(id=>id==='captain:tab:argos')).toBe(true);
 await expect(page.locator('#sinbad-ai [data-open="sinbad"]:not([data-target-tab])')).toHaveAttribute('data-favorite-target','workspace:sinbad');
 for(const tab of ['chat','academy','argos'])await expect(page.locator(`[data-sinbad-tab="${tab}"]`)).toBeVisible();
 await expect(page.locator('#sinbad-tab-chat')).toHaveAttribute('aria-selected','true');
 const star=page.locator('.sinbad-favorite-star[data-favorite-id="captain:tab:argos"]:visible').first();
 await star.click();
 expect(page.context().pages()).toHaveLength(1);
 await expect(page.locator('#sinbad-tab-chat')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.sinbad-favorite-popover')).toBeVisible();
 await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sinbad_favorites_v2:unit-project:synthetic-user-argos')||'[]'))).toContain('captain:tab:argos');
 await star.click();
 await page.getByRole('button',{name:'Remove from favorites',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sinbad_favorites_v2:unit-project:synthetic-user-argos')||'[]'))).not.toContain('captain:tab:argos');
 await star.click();
 await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
 await page.locator('[data-window-home]').click();
 await page.waitForURL(/\/index\.html$/);
 await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');SinbadFavorites.setScope('unit-project','synthetic-user-argos');});
 await page.locator('#consoleFavoritesPanel [data-console-favorites]').click();await expect(page.locator('#consoleFavoritesDialog')).toBeVisible();
 const row=page.locator('#consoleFavoritesOptions [data-favorite-open="captain:tab:argos"]');
 await expect(row).toBeVisible();
 await row.click();
 await page.waitForTimeout(300);
 expect(page.context().pages()).toHaveLength(1);
 const opened=page.waitForEvent('popup');
 await row.dblclick();
 const child=await opened;
 await child.waitForURL(/workspace=sinbad/);
 await child.waitForURL(/tab=argos/);
 await child.close();
 expect(page.context().pages()).toHaveLength(1);
});
test('favorite star layout settles, then runs again for scroll, resize, and closed details',async({page})=>{
  await blocked(page);
  await page.route('**/__star_settle_fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><link rel="stylesheet" href="/sinbad-favorites.css"><style>#visible,#hidden-target,#offscreen,#covered{position:absolute;left:80px;width:220px;height:80px}#visible{top:80px}#hidden-target{top:200px}#offscreen{top:-500px}#covered{top:320px}#cover{position:absolute;left:70px;top:310px;width:240px;height:100px;z-index:5}#clip{position:absolute;left:80px;top:460px;width:260px;height:90px;overflow:auto}#inside{width:240px;height:80px;margin-top:200px}#box{position:absolute;left:420px;top:80px}#box summary{display:block;width:180px;height:48px}#detail-target{width:180px;height:80px}</style><button id="visible">Visible</button><div hidden><button id="hidden-target">Hidden</button></div><button id="offscreen">Offscreen</button><button id="covered">Covered</button><div id="cover"></div><div id="clip"><button id="inside">Clipped</button></div><details id="box" open><summary>Section</summary><button id="detail-target">Inside</button></details><script>window.__raf=0;const orig=requestAnimationFrame;window.requestAnimationFrame=function(cb){window.__raf+=1;return orig.call(window,cb);};</script><script src="/sinbad-favorites-catalog.js"></script><script src="/sinbad-favorites.js"></script>`}));
  await page.goto('/__star_settle_fixture.html');
  await page.evaluate(()=>{SinbadFavorites.decorate(document.getElementById('visible'),'workspace:fleet');SinbadFavorites.decorate(document.getElementById('hidden-target'),'workspace:store');SinbadFavorites.decorate(document.getElementById('offscreen'),'workspace:yacht-operations');SinbadFavorites.decorate(document.getElementById('covered'),'workspace:documents');SinbadFavorites.decorate(document.getElementById('inside'),'workspace:voyage-navigation');SinbadFavorites.decorate(document.getElementById('detail-target'),'workspace:charts');});
  const star=id=>page.locator(`.sinbad-favorite-star[data-favorite-id="${id}"]`);
  await expect(star('workspace:fleet')).toBeVisible();
  await expect(star('workspace:store')).toBeHidden();
  await expect(star('workspace:yacht-operations')).toBeHidden();
  await expect(star('workspace:documents')).toBeHidden();
  await expect(star('workspace:voyage-navigation')).toBeHidden();
  await expect(star('workspace:charts')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const settled=await page.evaluate(()=>window.__raf);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__raf)).toBe(settled);
  await page.locator('#clip').evaluate(el=>{el.scrollTop=200;});
  await expect(star('workspace:voyage-navigation')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const scrolled=await page.evaluate(()=>window.__raf);
  expect(scrolled).toBeGreaterThan(settled);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__raf)).toBe(scrolled);
  await page.setViewportSize({width:1100,height:760});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const resized=await page.evaluate(()=>window.__raf);
  expect(resized).toBeGreaterThan(scrolled);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__raf)).toBe(resized);
  await page.locator('#box').evaluate(el=>{el.open=false;});
  await expect(star('workspace:charts')).toBeHidden();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const closed=await page.evaluate(()=>window.__raf);
  expect(closed).toBeGreaterThan(resized);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__raf)).toBe(closed);
});
test('blocked favorite storage and session storage keep the page usable and do not write favorites',async({page})=>{
  await blocked(page);
  await page.route('**/__storage_fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>#target{display:block;width:240px;height:80px;margin:48px}</style><div data-favorites-list></div><button id="target">Fleet</button><script>window.__writes=[];const local={getItem(){throw new Error('read-denied');},setItem(key,value){window.__writes.push([key,value]);throw new Error('write-denied');},removeItem(key){window.__writes.push(['remove',key]);throw new Error('remove-denied');}};Object.defineProperty(window,'localStorage',{configurable:true,get(){return local;}});Object.defineProperty(window,'sessionStorage',{configurable:true,get(){throw new Error('session-denied');}});</script><script src="/sinbad-favorites-catalog.js"></script><script src="/sinbad-favorites.js"></script><script src="/sinbad-favorites-pages.js"></script>`}));
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/__storage_fixture.html');
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  await page.evaluate(()=>SinbadFavorites.decorate(document.getElementById('target'),'workspace:fleet'));
  await expect(page.locator('[data-favorites-list]')).toContainText('could not be saved');
  await expect(page.locator('[data-favorites-list]')).not.toContainText('Sign in');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  await page.evaluate(()=>SinbadFavorites.setScope('project','user-a'));
  await expect(page.locator('[data-favorites-list]')).toContainText('could not be saved');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  await page.locator('.sinbad-favorite-star').click();
  await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
  await expect(page.locator('.sinbad-favorite-popover')).toContainText('could not be saved');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  await page.evaluate(async()=>{const client={auth:{onAuthStateChange(callback){callback('SIGNED_IN',{user:{id:'user-a'}});return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:{id:'user-a',invited_at:'2020-01-01T00:00:00Z'}}},error:null};}}};await SinbadFavorites.bindAuth(client,'project');});
  await expect(page.locator('[data-favorite-open]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  expect(errors).toEqual([]);
});
test('signed-out visitors can open the dashboard without seeing the Local status strip',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await blocked(page);await page.goto('/index.html');
 await expect(page.locator('body')).toHaveClass(/signed-out/);
 await expect(page.locator('.card-yacht')).toBeVisible();
 await expect(page.locator('[data-i18n="signIn"]')).toBeVisible();
 await expect(page.locator('[data-i18n="createAccount"]')).toBeVisible();
 await expect(page.locator('[data-console-status="local"]')).toBeHidden();
 await expect(page.locator('[data-console-home]')).toBeHidden();
 await expect(page.locator('.console-dock-actions [data-open="routes"]')).toHaveCount(0);
 await expect(page.locator('#consoleStatusChecked')).toHaveCount(0);
});

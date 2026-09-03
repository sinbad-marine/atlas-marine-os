const {test,expect}=require('@playwright/test');

async function prepareVerifiedOwner(page){
  const workspace='22222222-2222-4222-8222-222222222222',instance='33333333-3333-4333-8333-333333333333';
  await page.route('http://127.0.0.1:31983/argos/status',route=>route.fulfill({json:{ownerBoundary:{enforced:true,configured:true,workspaceId:workspace,instanceId:instance}}}));
  await page.evaluate(workspace=>{
    cloudSession={user:{id:'isolated-owner'}};selectedWorkspaceId=workspace;
    cloudClient={auth:{getSession:async()=>({data:{session:{access_token:'synthetic.owner.token'}}}),mfa:{listFactors:async()=>({data:{totp:[]}}),getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}},functions:{invoke:async()=>({data:{authorizationId:crypto.randomUUID(),nonce:'ab'.repeat(32),expiresAt:new Date(Date.now()+300000).toISOString()}})}};
  },workspace);
}


test('desktop chart console keeps route tools left, chart centre and settings right',async({page})=>{
  await page.setViewportSize({width:2400,height:1000});
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated')});
  const tools=page.locator('.enc-chart-tools'),map=page.locator('.enc-chart-canvas'),settings=page.locator('.enc-chart-settings');
  const [toolsBox,mapBox,settingsBox]=await Promise.all([tools.boundingBox(),map.boundingBox(),settings.boundingBox()]);
  const workspaceBox=await page.locator('#enc-viewer').boundingBox();
  expect(workspaceBox.x).toBeLessThanOrEqual(12);
  expect(workspaceBox.x+workspaceBox.width).toBeGreaterThanOrEqual(2388);
  expect(toolsBox.x+toolsBox.width).toBeLessThan(mapBox.x);
  expect(mapBox.x+mapBox.width).toBeLessThan(settingsBox.x);
  await expect(tools.locator('#encDrawRouteTool')).toBeVisible();
  await expect(settings.locator('#encMapAppsMenu')).toBeVisible();
  await expect(settings.locator('#encLayerToggle')).toBeVisible();
  await expect(page.locator('.workspace-window-controls')).toBeVisible();
  await page.locator('[data-window-scale]').click();
  await expect(page.locator('body')).toHaveClass(/workspace-window-fit/);
  await page.locator('[data-window-minimize]').click();
  await expect(page.locator('body')).toHaveClass(/workspace-window-minimized/);
  await expect(page.locator('#enc-viewer')).toBeHidden();
  await page.locator('[data-window-minimize]').click();
  await expect(page.locator('#enc-viewer')).toBeVisible();
});

test('direct ENC workspace initializes its map and OpenCPN controls',async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});

  await expect(page.locator('#encMap .ol-viewport')).toBeVisible();
  await page.locator('#encMapAppsMenu > summary').click();
  await page.getByRole('button',{name:'OpenCPN Yerel Canlı Görüntü'}).click();
  await expect(page.locator('#encOpenCpnShell')).toBeVisible();
  await expect(page.locator('#encOpenCpnFrame')).toBeHidden();
  await expect(page.locator('#encOpenCpnFrame')).not.toHaveAttribute('src',/.+/);
  await page.locator('#encMapAppsMenu > summary').click();
  await page.getByRole('button',{name:'Web ENC Haritasına Dön'}).click();
  await expect(page.locator('#encMap .ol-viewport')).toBeVisible();

  await page.locator('#encDraft').fill('3.2');
  await expect(page.locator('#encSafetyDepth')).toHaveText('4.5 m');
});

test('armed OpenCPN surface forwards bounded local mouse and keyboard controls',async({page})=>{
  const inputs=[];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==','base64');
  await page.route('http://127.0.0.1:31983/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/opencpn/start'||url.pathname==='/opencpn/status')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({installed:true,running:true,minimized:false,title:'OpenCPN test',pid:42})});
    if(url.pathname==='/opencpn/frame')return route.fulfill({status:200,contentType:'image/png',body:png});
    if(url.pathname==='/opencpn/input'){inputs.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}
    return route.fulfill({status:404,body:''});
  });
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  await prepareVerifiedOwner(page);
  await page.locator('#encMapAppsMenu > summary').click();
  await page.getByRole('button',{name:'OpenCPN Yerel Canlı Görüntü'}).click();
  await page.getByRole('button',{name:'OpenCPN kontrolü: Kapalı'}).click();
  const frame=page.locator('#encOpenCpnFrame');
  await expect(frame).toHaveClass(/interactive/);
  await frame.evaluate(image=>{
    image.setPointerCapture=()=>{};
    const rect=image.getBoundingClientRect(),fire=(type,button,x,y)=>image.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,button,clientX:rect.left+x,clientY:rect.top+y}));
    fire('pointerdown',0,350,250);fire('pointerup',0,350,250);
    fire('pointerdown',2,420,280);fire('pointerup',2,420,280);
    image.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'ğ'}));
    image.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'s',ctrlKey:true}));
  });
  await expect.poll(()=>inputs.map(item=>item.action)).toEqual(expect.arrayContaining(['click','rightClick','text','shortcut']));
  expect(inputs.find(item=>item.action==='text')?.text).toBe('ğ');
  expect(inputs.find(item=>item.action==='shortcut')?.key.toLowerCase()).toBe('s');
});

test('imports a local Bridge GPX, calculates legs and sends it to OpenCPN after approval',async({page})=>{
  const opened=[];
  const gpx='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><rte><name>Marmaris Rodos</name><rtept lat="36.8500" lon="28.2700"><name>Marmaris</name></rtept><rtept lat="36.4500" lon="28.2200"><name>WP02</name></rtept><rtept lat="36.1600" lon="28.0000"><name>Rodos</name></rtept></rte></gpx>';
  await page.route('http://127.0.0.1:31983/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/routes'&&route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({routes:[{name:'marmaris-rodos.gpx',size:gpx.length,modified:'2026-08-29T00:00:00Z'}]})});
    if(url.pathname==='/routes/read')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({filename:'marmaris-rodos.gpx',gpx})});
    if(url.pathname==='/routes/open'){opened.push(route.request().postDataJSON());return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,imported:true})});}
    if(url.pathname==='/opencpn/start'||url.pathname==='/opencpn/status')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({installed:true,running:true,minimized:false,title:'OpenCPN test'})});
    return route.fulfill({status:503,contentType:'application/json',body:'{}'});
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated')});
  await prepareVerifiedOwner(page);
  await page.locator('#encRouteSelect').selectOption('marmaris-rodos.gpx');
  await page.locator('#encLoadRoute').click();
  await expect(page.locator('#encPassageSummary')).toContainText('Marmaris Rodos');
  await expect(page.locator('#encLegRows tr')).toHaveCount(2);
  await expect(page.locator('#encPassageDraft')).toContainText('KAPTAN ONAYI');
  await expect(page.locator('#encPublicationRows')).toContainText('NP286(3)');
  await expect(page.locator('#encReportingRows')).toContainText('Marmaris');
  await expect(page.locator('#encSendPassageToOpenCpn')).toBeDisabled();
  await page.locator('#encMasterApproval').check();
  await page.locator('#encSendPassageToOpenCpn').click();
  await expect.poll(()=>opened.length).toBe(1);
  expect(opened[0].filename).toBe('marmaris-rodos.gpx');
});

test('controls every active web chart layer and turns a drawn route into a passage plan',async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated')});
  await page.locator('#encBathymetryToggle').uncheck();
  await page.locator('#encSeamarkToggle').uncheck();
  await page.locator('#encLayerToggle').uncheck();
  await page.locator('#encBathymetryToggle').check();
  await page.locator('#encSeamarkToggle').check();
  await page.locator('#encLayerToggle').check();
  await page.locator('#encMapAppsMenu > summary').click();
  await page.getByRole('button',{name:/Koyu Gri/}).click();
  await expect(page.locator('[data-enc-basemap="dark-gray"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#encPlanningStatus')).toContainText('Harita formatı: Koyu Gri');
  await expect(page.locator('#encLayerToggle')).toBeChecked();
  await expect(page.locator('#encSeamarkToggle')).toBeChecked();
  await page.locator('#encDrawRouteTool').click();
  await expect(page.locator('#encDrawRouteTool')).toHaveAttribute('aria-pressed','true');
  const map=page.locator('#encMap');await map.scrollIntoViewIfNeeded();const box=await map.boundingBox();
  await page.mouse.click(box.x+box.width*.25,box.y+box.height*.55);
  await page.mouse.click(box.x+box.width*.5,box.y+box.height*.42);
  await page.mouse.dblclick(box.x+box.width*.72,box.y+box.height*.58);
  await expect(page.locator('#encPlanningStatus')).toContainText('Çizilen rota');
  await expect(page.locator('#encRouteToPassage')).toBeEnabled();
  await page.locator('#encRouteToPassage').click();
  await expect(page.locator('#encLegRows tr')).toHaveCount(2);
  await expect(page.locator('#encPassageDraft')).toContainText('KAPTAN ONAYI');
  await page.locator('#encAdmiraltyCatalogFile').setInputFiles({name:'adc-route.csv',mimeType:'text/csv',buffer:Buffer.from('Product,Title\nGB123456,Approach\nNP286(3),Radio')});
  await expect(page.locator('#encChartRows')).toContainText('GB123456');
  await expect(page.locator('#encAdmiraltyCatalogStatus')).toContainText('2 harita/yayın kodu');
});

test('fullscreen command targets only the chart panel',async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{
    document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    const shell=document.querySelector('#encMap').closest('.enc-map-shell');
    shell.requestFullscreen=async()=>{document.body.dataset.fullscreenTarget=shell.className};
  });
  await page.locator('#encFullscreenMap').click();
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.fullscreenTarget)).toContain('enc-map-shell');
});

test('fullscreen chart exposes working planning controls over the map',async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');const shell=document.querySelector('.enc-map-shell');Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>shell});document.dispatchEvent(new Event('fullscreenchange'))});
  const overlay=page.locator('.enc-fullscreen-tools');
  await expect(overlay).toBeVisible();
  await overlay.getByRole('button',{name:/Rota/}).click();
  await expect(page.locator('#encDrawRouteTool')).toHaveAttribute('aria-pressed','true');
  await expect(overlay.getByRole('button',{name:/Rota/})).toHaveAttribute('aria-pressed','true');
  await overlay.getByRole('button',{name:/Temizle/}).click();
  await expect(page.locator('#encPanTool')).toHaveAttribute('aria-pressed','true');
});

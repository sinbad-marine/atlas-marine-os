const {test,expect}=require('@playwright/test');

test('direct ENC workspace initializes its map and OpenCPN controls',async({page})=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.goto('/index.html?workspace=enc-viewer');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});

  await expect(page.locator('#encMap .ol-viewport')).toBeVisible();
  await page.getByRole('button',{name:'OpenCPN Yerel Canlı Görüntü'}).click();
  await expect(page.locator('#encOpenCpnShell')).toBeVisible();
  await expect(page.getByRole('button',{name:'Web ENC Haritasına Dön'})).toBeVisible();

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
  await page.locator('#encRouteSelect').selectOption('marmaris-rodos.gpx');
  await page.locator('#encLoadRoute').click();
  await expect(page.locator('#encPassageSummary')).toContainText('Marmaris Rodos');
  await expect(page.locator('#encLegRows tr')).toHaveCount(2);
  await expect(page.locator('#encPassageDraft')).toContainText('KAPTAN ONAYI');
  await page.locator('#encSendPassageToOpenCpn').click();
  await expect.poll(()=>opened.length).toBe(1);
  expect(opened[0].filename).toBe('marmaris-rodos.gpx');
});

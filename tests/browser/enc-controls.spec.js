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

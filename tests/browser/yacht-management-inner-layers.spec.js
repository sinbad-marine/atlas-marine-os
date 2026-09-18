'use strict';
const path=require('node:path');
const {test,expect}=require('@playwright/test');

const openLayer=async(page,id)=>{
  await page.goto(`/index.html?workspace=${id}`);
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  await page.waitForFunction(layer=>[...document.querySelectorAll(`#${layer} img`)].every(image=>image.complete&&image.naturalWidth>0),id);
  await expect(page.locator('body')).toHaveAttribute('data-console-art','rembrandt');
  await expect(page.locator(`#${id}`)).toHaveClass(/\bactive\b/u);
  await expect(page.locator(`#${id} .yacht-detail-art img`)).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

test('Fleet and Crew layers preserve local records inside the new visual hierarchy',async({page,isMobile})=>{
  await openLayer(page,'fleet');
  await page.locator('#vName').fill('S/Y Test Vessel');
  await page.locator('#vType').fill('Motor Yacht');
  await page.locator('#vFlag').fill('TR');
  await page.locator('#vDraft').fill('2.4');
  await page.locator('#vCruise').fill('12');
  await page.locator('#saveVessel').click();
  await expect(page.locator('#fleetList')).toContainText('S/Y Test Vessel');
  await expect(page.locator('#fleetList')).toContainText('2.4 m');
  await page.evaluate(()=>window.scrollTo(0,0));
  if(!isMobile)await page.screenshot({path:path.resolve('tmp/yacht-inner-fleet-review.png'),fullPage:true});

  await openLayer(page,'crew');
  await page.locator('#crewName').fill('Test Crew');
  await page.locator('#crewRank').fill('Chief Officer');
  await page.locator('#crewNationality').fill('TR');
  await page.locator('#crewPassport').fill('2030-01-01');
  await page.locator('#saveCrew').click();
  await expect(page.locator('#crewList')).toContainText('Test Crew');
  await expect(page.locator('#crewList')).toContainText('Passport');
  await page.evaluate(()=>window.scrollTo(0,0));
  if(!isMobile)await page.screenshot({path:path.resolve('tmp/yacht-inner-crew-review.png'),fullPage:true});
});

test('Logbook and Media layers retain their controlled operational tools',async({page,isMobile})=>{
  await openLayer(page,'captains-logbook');
  await expect(page.locator('#captains-logbook .log-safety-note')).toContainText('not the statutory logbook');
  await page.locator('#logDraftText').fill('Test operational entry');
  await page.locator('#saveLogDraft').click();
  await expect(page.locator('#logDraftList')).toContainText('Test operational entry');
  await page.evaluate(()=>window.scrollTo(0,0));
  if(!isMobile)await page.screenshot({path:path.resolve('tmp/yacht-inner-logbook-review.png'),fullPage:true});

  await openLayer(page,'camera-archive');
  await expect(page.locator('#cameraPermissionBanner')).toBeVisible();
  await expect(page.locator('#startCamera')).toBeEnabled();
  await expect(page.locator('#uploadCapturedMedia')).toBeDisabled();
  await expect(page.locator('#capturedMediaGallery')).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  if(!isMobile)await page.screenshot({path:path.resolve('tmp/yacht-inner-media-review.png'),fullPage:true});
});

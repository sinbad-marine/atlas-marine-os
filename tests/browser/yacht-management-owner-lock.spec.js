'use strict';
const path=require('node:path');
const {test,expect}=require('@playwright/test');

test('Owner-locked Yacht Management composition uses the approved routes and art',async({page,isMobile})=>{
  await page.goto('/index.html?workspace=yacht-operations');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');});
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  await page.waitForFunction(()=>[...document.querySelectorAll('#yacht-operations img')].every(image=>image.complete&&image.naturalWidth>0));
  await expect(page.locator('body')).toHaveAttribute('data-console-art','rembrandt');
  await expect(page.locator('body>.topbar')).not.toBeVisible();
  await expect(page.locator('#yacht-operations')).toHaveClass(/\bactive\b/u);
  await expect(page.locator('#yacht-operations[data-owner-visual-lock="yacht-management-owner-selections-v1"]')).toHaveCount(1);
  for(const id of ['fleet','crew','captains-logbook','camera-archive'])await expect(page.locator(`#yacht-operations [data-open="${id}"]`)).toHaveCount(2);
  if(!isMobile){
    const brandBounds=await page.locator('.yacht-page-brand').evaluate(link=>{const outer=link.getBoundingClientRect(),image=link.querySelector('img').getBoundingClientRect();return {outer:{top:outer.top,right:outer.right,bottom:outer.bottom,left:outer.left},image:{top:image.top,right:image.right,bottom:image.bottom,left:image.left}};});
    expect(brandBounds.image.top).toBeGreaterThanOrEqual(brandBounds.outer.top);
    expect(brandBounds.image.right).toBeLessThanOrEqual(brandBounds.outer.right);
    expect(brandBounds.image.bottom).toBeLessThanOrEqual(brandBounds.outer.bottom);
    expect(brandBounds.image.left).toBeGreaterThanOrEqual(brandBounds.outer.left);
    const boxes=await page.locator('.yacht-function-card').evaluateAll(cards=>cards.map(card=>{const box=card.getBoundingClientRect(),image=card.querySelector('img').getBoundingClientRect(),title=card.querySelector('b').getBoundingClientRect();return {top:box.top,bottom:box.bottom,width:box.width,height:box.height,imageHeight:image.height,titleTop:title.top};}));
    expect(boxes).toHaveLength(4);
    for(const box of boxes.slice(1)){
      expect(box.top).toBe(boxes[0].top);expect(box.bottom).toBe(boxes[0].bottom);
      expect(box.width).toBe(boxes[0].width);expect(box.height).toBe(boxes[0].height);
      expect(box.imageHeight).toBe(boxes[0].imageHeight);expect(box.titleTop).toBe(boxes[0].titleTop);
    }
    for(const box of boxes){
      expect(Math.abs(box.top-238)).toBeLessThanOrEqual(1);expect(Math.abs(box.bottom-598)).toBeLessThanOrEqual(1);
      expect(box.width).toBe(169);expect(box.height).toBe(360);expect(box.imageHeight).toBe(240);expect(Math.abs(box.titleTop-451)).toBeLessThanOrEqual(1);
    }
    if(process.platform==='win32')await expect(page).toHaveScreenshot('yacht-management-owner-canonical.png',{fullPage:true});
    await page.screenshot({path:path.resolve('tmp/yacht-management-owner-review.png'),fullPage:true});
  }
});

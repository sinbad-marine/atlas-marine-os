'use strict';
const {test,expect}=require('@playwright/test');

async function openDocuments(page){
  await page.goto('/index.html?workspace=documents-compliance');
  await page.evaluate(()=>{document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');window.openWorkspace?.('documents-compliance');window.applyConsoleArt?.('documents-compliance');});
  await expect(page.locator('#documents-compliance')).toHaveClass(/active/u);
}

test('Owner-selected C keeps truthful register, unique art and canonical navigation',async({page})=>{
  await openDocuments(page);
  await expect(page.locator('body')).toHaveAttribute('data-console-art','vermeer');
  await expect(page.locator('#documents-compliance .dc-empty-row')).toContainText('No verified records loaded');
  await expect(page.locator('#documents-compliance [data-open="charts"]')).toHaveCount(0);
  await expect(page.locator('#documents-compliance [data-open="publications"]')).toHaveCount(0);
  for(const label of ['Home','Yacht Management','Voyage Planning','SINBAD Academy','Documents & Compliance','Technical Systems','SINBAD AI','Marine Store'])await expect(page.locator('.console-primary-nav').getByText(label,{exact:true})).toHaveCount(1);
  const sources=await page.locator('#documents-compliance .dc-function-card img').evaluateAll(images=>images.map(image=>image.getAttribute('src')));
  expect(sources).toHaveLength(4);
  expect(new Set(sources).size).toBe(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await expect(page.locator('.topbar')).toBeHidden();
  const firstCard=page.locator('#documents-compliance .dc-function-card').first();
  const [cardBox,imageBox]=await Promise.all([firstCard.boundingBox(),firstCard.locator('img').boundingBox()]);
  expect(Math.abs(imageBox.y-cardBox.y)).toBeLessThanOrEqual(2);
});

test('mobile register and primary navigation stay accessible',async({page,isMobile})=>{
  test.skip(!isMobile,'mobile-only layout contract');
  await openDocuments(page);
  await page.locator('.dc-empty-row').scrollIntoViewIfNeeded();
  await expect(page.locator('.dc-empty-row')).toBeInViewport();
  await expect(page.locator('.dc-empty-row button')).toBeInViewport();
  const toggle=page.locator('.dc-mobile-nav-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('#consoleSidebar')).toBeVisible();
  await expect(page.locator('#consoleSidebar').getByText('Voyage Planning',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

for(const id of ['cloud-documents','documents','knowledge','document-submissions']){
  test(`Documents card opens its real ${id} workspace`,async({page})=>{
    await openDocuments(page);
    await page.locator(`#documents-compliance .dc-function-card[data-open="${id}"]`).click();
    await expect(page.locator(`#${id}`)).toHaveClass(/active/u);
    await expect(page.locator('body')).toHaveAttribute('data-console-art','vermeer');
  });
}

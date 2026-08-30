const {test,expect}=require('@playwright/test');

test('public Store is shareable, interactive and keeps commerce disabled',async({page})=>{
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('/store/index.html');
  await expect(page).toHaveTitle(/SINBAD Marine Store/u);
  await expect(page.getByText('Demo katalog · ödeme kapalı')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Denize hazır/u})).toBeVisible();
  await page.getByRole('button',{name:'Seyir & Köprüüstü'}).click();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByRole('button',{name:'Sepete ekle'}).first().click();
  await expect(page.locator('#cartCount')).toHaveText('1');
  await expect(page.getByRole('button',{name:/Güvenli ödeme — yakında/u})).toBeDisabled();
  expect(errors).toEqual([]);
});

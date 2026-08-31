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

test('Store translates the complete commerce journey into English and Spanish',async({page})=>{
  await page.goto('/store/index.html');
  const language=page.locator('#storeLanguage');

  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page).toHaveURL(/lang=en/u);
  await expect(page.getByText('Demo catalogue · checkout disabled')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Ready for sea/u})).toBeVisible();
  await expect(page.getByRole('heading',{name:'100N Lifejacket'})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Sepet|Teklif oluştur|Ürünleri keşfet|Tedarikçiden doğrulanacak/u);
  await page.getByRole('button',{name:'Show compatible products'}).click();
  await expect(page.getByText('Relevant product family opened for Motor yacht.')).toBeVisible();
  await page.getByRole('button',{name:'View'}).first().click();
  await expect(page.getByRole('button',{name:'Technical specifications'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();

  await language.selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang','es');
  await expect(page).toHaveURL(/lang=es/u);
  await expect(page.getByText('Catálogo de demostración · pago desactivado')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Listo para navegar/u})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Chaleco salvavidas 100N'})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Cart|Create quote|Explore products|To be verified with supplier/u);
  await page.getByRole('button',{name:'Añadir al carrito'}).first().click();
  await expect(page.getByText(/añadido al carrito/u)).toBeVisible();
  await expect(page.getByRole('button',{name:/Pago seguro — próximamente/u})).toBeDisabled();

  await page.reload();
  await expect(language).toHaveValue('es');
  await expect(page.getByText('Catálogo de demostración · pago desactivado')).toBeVisible();
});

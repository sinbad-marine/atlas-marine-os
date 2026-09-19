'use strict';
const {test,expect}=require('@playwright/test');

// Owner-approved Academy navigation: exact landing art, exact section art, then live tools on demand.
const SELECTION_KEY='atlas_sinbad_academy_selection';

const openAcademy=async page=>{
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"routes":0,"library":{"chunks":0},"status":"STUDIO_RUNTIME_INCOMPLETE"}'}));
  await page.goto('/academy.html');
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('#academyWorkspace')).toBeHidden();
};

const openLayer=async(page,section)=>{
  await page.locator(`.academy-landing-hotspots [data-academy-open="${section}"]`).click({force:true});
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','layer');
  await expect(page.locator(`[data-academy-art="${section}"].is-active`)).toBeVisible();
  await expect(page.locator('#academyTeachingStage')).toBeHidden();
};

const openLessonTools=async page=>{
  await page.locator('.academy-layer-hotspots [data-academy-command="lesson"]:visible').first().click();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');
  await expect(page.locator('#academyModule')).toBeVisible();
};

test('Academy opens on the approved landing and General Maritime opens as a clean art layer',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'general-maritime-education');
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
  await openLessonTools(page);
  await expect(page.locator('#academyTeachingStage')).toBeVisible();
});

test('chosen department and module are restored after a browser refresh',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'ism-isps-mlc');
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','ism-isps-mlc');
  await expect(page.locator('[data-academy-section="ism-isps-mlc"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).not.toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await expect(page.locator('#academyTeachingStage')).toHaveAttribute('data-phase','welcome');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),SELECTION_KEY);
  expect(saved).toEqual({section:'ism-isps-mlc',module:'ism-code-foundations'});
});

test('a module chosen inside a department is restored too, and the change is remembered',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'stcw');
  await openLessonTools(page);
  await page.locator('#academyModule').selectOption('marine-weather');
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','stcw');
  await expect(page.locator('[data-academy-section="stcw"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('marine-weather');
});

test('a stale or foreign saved selection falls back to the default department',async({page})=>{
  await openAcademy(page);
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'__proto__',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('.academy-landing')).toBeVisible();
  await expect(page.locator('[data-academy-section="general-maritime-education"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({section:'stcw',module:'ism-code-foundations'})),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','stcw');
  await expect(page.locator('#academyModule')).toHaveValue('stcw-foundation','a module outside the department is ignored');
  await page.evaluate(key=>localStorage.setItem(key,'{not json'),SELECTION_KEY);
  await page.reload();
  await expect(page.locator('#academyModule')).toHaveValue('general-maritime-education');
});

test('the cards drawn inside every approved Academy layer open their matching live destination',async({page})=>{
  await openAcademy(page);
  await openLayer(page,'goss-gasm');
  await page.getByRole('button',{name:'Open Deck qualifications'}).click();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');
  await expect(page.locator('[data-gasm-family="deck"]')).toHaveClass(/\bactive\b/u);
  await expect(page.locator('#gasmQualificationMenu')).toBeVisible();
  await expect(page.locator('.gasm-branch[data-gasm-branch="DECK"]')).toHaveAttribute('open','');
  await expect(page.locator('.gasm-branch[data-gasm-branch="DECK"] > summary')).toBeFocused();

  await page.goto('/academy.html');
  await openLayer(page,'goss-gasm');
  await page.getByRole('button',{name:'Open Engine qualifications'}).click();
  await expect(page.locator('.gasm-branch[data-gasm-branch="ENGINE"]')).toHaveAttribute('open','');
  await expect(page.locator('.gasm-branch[data-gasm-branch="DECK"]')).not.toHaveAttribute('open','');

  await page.goto('/academy.html');
  await openLayer(page,'goss-gasm');
  await page.getByRole('button',{name:'Open Electro-Technical qualifications'}).click();
  await expect(page.locator('.gasm-branch[data-gasm-branch="ELECTRO_TECHNICAL"]')).toHaveAttribute('open','');
  await expect(page.locator('.gasm-branch[data-gasm-branch="ENGINE"]')).not.toHaveAttribute('open','');

  await page.goto('/academy.html');
  await openLayer(page,'goss-gasm');
  await page.getByRole('button',{name:'Open GOC and ROC radio qualifications'}).click();
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-active','goc');
  await expect(page.locator('[data-academy-art="goc"].is-active')).toBeVisible();

  await page.goto('/academy.html');
  await openLayer(page,'stcw');
  await page.getByRole('button',{name:'Open Personal Survival training'}).click();
  await expect(page.locator('#academyModule')).toHaveValue('stcw-foundation');
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');

  await page.goto('/academy.html');
  await openLayer(page,'goc');
  await page.getByRole('button',{name:'Open GOC and ROC practice questions'}).click();
  await expect(page.locator('#academyModule')).toHaveValue('goc-foundation');
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');

  await page.goto('/academy.html');
  await openLayer(page,'general-maritime-education');
  if((page.viewportSize()?.width||0)<820){
    const targets=page.locator('[data-academy-scope="general-maritime-education"][data-academy-command]');
    for(let index=0;index<await targets.count();index++){
      const box=await targets.nth(index).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(24);
      expect(box?.height).toBeGreaterThanOrEqual(24);
    }
  }
  await page.getByRole('button',{name:'Open Marine Weather'}).click();
  await expect(page.locator('#academyModule')).toHaveValue('marine-weather');
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');
  await expect(page.locator('#academyTeachingTitle')).toBeFocused();

  await page.goto('/academy.html');
  await openLayer(page,'ism-isps-mlc');
  await page.getByRole('button',{name:'Open ISPS Code lessons'}).click();
  await expect(page.locator('#academyModule')).toHaveValue('ism-code-foundations');
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');

  await page.goto('/academy.html');
  await page.locator('.academy-landing-hotspots [data-academy-open="professor-sinbad"]').click();
  await expect(page.locator('[data-academy-art="professor-sinbad"].is-active')).toBeVisible();
  await page.getByRole('button',{name:'Open the Professor Sinbad lesson'}).click();
  await expect(page.locator('#academyModule')).toHaveValue('colregs-navigation-rules');
  await expect(page.locator('.academy-shell')).toHaveAttribute('data-academy-view','tools');
});

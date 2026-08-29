const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('independent workspace windows rely on the native title-bar close control',()=>{
  assert.match(app,/workspace\.querySelectorAll\('\.close'\)\.forEach\(button=>button\.remove\(\)\)/);
  assert.doesNotMatch(app,/button\.textContent='Pencereyi kapat'/);
});

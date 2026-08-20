const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');

test('live application copy remains valid UTF-8 instead of mojibake',()=>{
  for(const expected of ['Türkçe','Tek Köprü. Tüm Operasyonlar.','Русский','Français','العربية','Español']){
    assert.ok(app.includes(expected),expected);
  }
  for(const broken of ['TÃ','KÃ','Â·','â€¢','â€¦','â€œ','Ø§','ÙŠ','Ğ Ñ','ğŸ']){
    assert.equal(app.includes(broken),false,broken);
  }
});

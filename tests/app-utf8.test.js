const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const changelog=fs.readFileSync(path.resolve(__dirname,'../CHANGELOG.md'),'utf8');
const liveChecklist=fs.readFileSync(path.resolve(__dirname,'../LIVE_TEST_CHECKLIST_TR.md'),'utf8');
const readme=fs.readFileSync(path.resolve(__dirname,'../README.md'),'utf8');
const readmeTr=fs.readFileSync(path.resolve(__dirname,'../README_TR.md'),'utf8');

test('live application copy remains valid UTF-8 instead of mojibake',()=>{
  for(const expected of ['Türkçe','Tek Köprü. Tüm Operasyonlar.','Русский','Français','العربية','Español']){
    assert.ok(app.includes(expected),expected);
  }
  for(const broken of ['TÃ','KÃ','Â·','â€¢','â€¦','â€œ','Ø§','ÙŠ','Ğ Ñ','ğŸ']){
    assert.equal(app.includes(broken),false,broken);
  }
});

test('Turkish and English README files describe the same release and safety boundary',()=>{
  const version=/^# Sinbad Marine v([^\r\n]+)/u;
  assert.equal(readmeTr.match(version)?.[1],readme.match(version)?.[1]);
  for(const marker of ['DECISION_SUPPORT_ONLY','PLAN_ONLY','CORE_GATE_BLOCKED','sinbad-answer']){
    assert.equal(readme.includes(marker),true,`English README missing ${marker}`);
    assert.equal(readmeTr.includes(marker),true,`Turkish README missing ${marker}`);
  }
});

test('release documents remain Markdown and cannot be silently replaced by application scripts',()=>{
  assert.match(changelog,/^# Sinbad Marine değişiklik günlüğü/u);
  assert.match(liveChecklist,/^# Sinbad Marine — Canlı test kontrol listesi/u);
  for(const document of [changelog,liveChecklist]){
    assert.doesNotMatch(document,/document\.getElementById|localStorage\.getItem|createElement\("canvas"\)/u);
  }
});

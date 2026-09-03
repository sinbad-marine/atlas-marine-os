'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const contract=JSON.parse(fs.readFileSync('config/ui-design-contract.json','utf8'));
const index=fs.readFileSync('index.html','utf8');
const academy=fs.readFileSync('academy.html','utf8');
const app=fs.readFileSync('app.js','utf8');

test('protected design files match the explicitly reviewed release',()=>{
  for(const [file,expected] of Object.entries(contract.protectedFileSha256)){
    const canonical=fs.readFileSync(file,'utf8').replace(/\r\n?/gu,'\n');
    const actual=crypto.createHash('sha256').update(canonical).digest('hex');
    assert.equal(actual,expected,`${file} changed without updating the reviewed design contract`);
  }
});

test('design contract has one canonical definition for every protected surface',()=>{
  assert.equal(contract.schemaVersion,'sinbad-ui-design-contract/v1');
  assert.equal(contract.dashboardWorkspaces.length,16);
  assert.equal(new Set(contract.dashboardWorkspaces).size,contract.dashboardWorkspaces.length);
  assert.deepEqual(Object.keys(contract.surfaces),['dashboard','captainSinbad','academy']);
  for(const [name,surface] of Object.entries(contract.surfaces)){
    assert.match(surface.route,/^\//u,name);
    assert.ok(surface.required.length>0,name);
    assert.ok(Array.isArray(surface.forbidden),name);
  }
});

test('every protected dashboard workspace has a launcher and one canonical surface',()=>{
  for(const id of contract.dashboardWorkspaces){
    assert.match(index,new RegExp(`data-open="${id}"`,'u'),`${id} launcher`);
    assert.equal((index.match(new RegExp(`id="${id}"`,'gu'))||[]).length,1,`${id} surface`);
  }
});

test('Captain Sinbad cannot silently restore retired navigation',()=>{
  assert.match(index,/data-sinbad-tab="chat"/u);
  assert.match(index,/data-sinbad-tab="academy"/u);
  assert.match(index,/data-sinbad-tab="argos"/u);
  assert.doesNotMatch(index,/data-sinbad-tab="(?:passage|sources)"/u);
  assert.doesNotMatch(index,/id="sinbad-panel-(?:passage|sources)"/u);
  assert.doesNotMatch(index,/sinbad-tools-menu/u);
  assert.match(app,/const SINBAD_WORKSPACE_TABS=Object\.freeze\(\['chat','academy','argos'\]\)/u);
});

test('dashboard and Captain Sinbad keep exactly two Academy entrances',()=>{
  assert.equal((index.match(/data-open-sinbad-academy/gu)||[]).length,2);
  assert.match(index,/id="openSinbadAcademyHomeCard"[^>]*data-open-sinbad-academy/u);
  assert.match(index,/id="openSinbadAcademyClassroom"[^>]*data-open-sinbad-academy/u);
});

test('Academy keeps its canonical classroom shell and navigation controls',()=>{
  for(const id of ['academyLanguage','academyBackButton','academyHomeButton','academyModule','openExamIntelligence','academyConversation','academyQuestionInput','toggleAcademyHandsFree','academyTeachingStage','academyLessonElapsed','academySinbadImage','academyTeachingTitle','academyTeachingText']){
    assert.match(academy,new RegExp(`id="${id}"`,'u'),id);
  }
  assert.match(academy,/id="openExamIntelligence"[^>]*>Öğrenci sınav ekranını aç<\/button>/u);
  assert.equal((academy.match(/data-academy-section=/gu)||[]).length,4);
});

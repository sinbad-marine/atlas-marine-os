'use strict';
const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const html=fs.readFileSync('academy-professor-native.html','utf8');
const css=fs.readFileSync('academy-professor-native.css','utf8');
const js=fs.readFileSync('academy-professor-native.js','utf8');

test('native Professor is one direct classroom, not an embedded Academy page',()=>{
  assert.doesNotMatch(html,/<iframe\b/i);
  for(const id of ['academyMessages','academyChatForm','academyQuestion','academyInstructorStage','professorBlackboard','professorMenu','phaseOneClassroom','closeAcademyWindow'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/academy-professor-handsfree\.js/);
});

test('secondary controls live in an off-canvas hamburger drawer',()=>{
  assert.match(html,/id="openProfessorMenu"[^>]*>☰</);
  assert.match(css,/\.native-drawer\{[^}]*position:fixed[^}]*transform:translateX\(102%\)/s);
  assert.match(css,/\.native-drawer\.open\{transform:translateX\(0\)\}/);
});

test('lesson board supports automatic summaries and future animation ownership',()=>{
  assert.match(js,/SinbadProfessorBoard=\{claimForAnimation\(\)/);
  assert.match(js,/releaseToLesson\(\)/);
  assert.match(js,/dataset\.owner!=='auto'/);
  assert.match(css,/"Segoe Print"/);
});

test('Turkish speech removes grouped-thousands dots before native TTS',()=>{
  assert.match(js,/normalizeTurkishSpeech/);
  assert.match(js,/\\b\\d\{1,3\}\(\?:\\\.\\d\{3\}\)\+\\b/);
  assert.match(js,/value\.replaceAll\('\.',''\)/);
  assert.match(js,/new NativeUtterance\(normalizeTurkishSpeech\(text\)\)/);
});

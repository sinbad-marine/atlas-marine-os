'use strict';
const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const html=fs.readFileSync('academy-professor-native.html','utf8');
const css=fs.readFileSync('academy-professor-native.css','utf8');
const js=fs.readFileSync('academy-professor-native.js','utf8');
const worker=fs.readFileSync('sw.js','utf8');

test('native Professor is one direct classroom, not an embedded Academy page',()=>{
  assert.doesNotMatch(html,/<iframe\b/i);
  for(const id of ['academyMessages','academyChatForm','academyQuestion','academyInstructorStage','professorBlackboard','professorMenu','phaseOneClassroom','closeAcademyWindow'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/academy-professor-handsfree\.js/);
  assert.match(html,/sinbad-speaker-identity\.js/);
  for(const id of ['voiceIdentityConsent','enrollVoiceIdentity','deleteVoiceIdentity','voiceIdentityStatus','learnerTitle'])assert.match(html,new RegExp(`id=["']${id}["']`));
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

test('speaker labels update only when their value changes and cannot create a mutation loop',()=>{
  assert.match(js,/if\(node\.textContent!==label\)node\.textContent=label/);
});

test('private publication UI fails closed while Professor lesson text remains exportable',()=>{
  assert.match(html,/data-source-access="restricted"/);
  for(const id of ['downloadLessonNotes','printLessonNotes','lessonExportStatus'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/\['owner','developer'\]\.includes\(data\.role\)/);
  assert.match(js,/document\.querySelectorAll\('\.academy-visuals'\)\.forEach\(node=>node\.remove\(\)\)/);
  assert.match(js,/function lessonNotes\(\)/);
  assert.match(js,/\.academy-message\.sinbad p/);
  assert.match(js,/sinbad-ders-notlari-/);
  assert.match(js,/popup\.print\(\)/);
  assert.doesNotMatch(js,/cloudClient\.storage|\.storage\.from/);
  assert.match(css,/body\[data-source-access="restricted"\] \.academy-visuals\{display:none!important\}/);
});

test('native Professor and consented identity module remain available from the offline shell',()=>{
  for(const file of ['academy-professor-native.html','academy-professor-native.css','academy-professor-native.js','sinbad-speaker-identity.js'])assert.match(worker,new RegExp(file.replaceAll('.','\\.')));
  assert.match(worker,/endsWith\('\/academy-professor-native\.html'\).*pageKey='\.\/academy-professor-native\.html'/s);
});

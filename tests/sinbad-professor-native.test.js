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
  for(const file of ['academy-professor-native.html','academy-professor-native.css','academy-professor-native.js','sinbad-speaker-identity.js','sinbad-tutor-orchestrator.js','sinbad-tutor-controller.js'])assert.match(worker,new RegExp(file.replaceAll('.','\\.')));
  assert.match(worker,/endsWith\('\/academy-professor-native\.html'\).*pageKey='\.\/academy-professor-native\.html'/s);
});

test('guided tutor orchestrator is optional, drawer-contained and backed by assessed checks',()=>{
  for(const id of ['tutorOrchestratorPanel','tutorTopic','startTutorSession','advanceTutorSession','abandonTutorSession','tutorProgress','tutorProgressBar','tutorObjectiveProgress','tutorSessionStatus','tutorKnowledgeCheck'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/sinbad-tutor-orchestrator\.js/);assert.match(html,/sinbad-tutor-controller\.js/);
  const controller=fs.readFileSync('sinbad-tutor-controller.js','utf8');
  assert.match(controller,/SinbadTutorOrchestrator\.create/);assert.match(controller,/kind:'knowledge-check'/);assert.match(controller,/SinbadAcademy\?\.quiz/);assert.match(controller,/objectives:checks\.map/);assert.doesNotMatch(controller,/objectiveIndex%/);assert.match(controller,/Başarı varsayılmadı/);
});

test('tutor waits for a completed Sinbad reply and merges the latest learner profile',()=>{
  const controller=fs.readFileSync('sinbad-tutor-controller.js','utf8');
  assert.match(controller,/pendingTeaching=\{sessionId:state\.session\.sessionId,assistantCount:/);
  assert.match(controller,/Açıklama tamamlandı\. Hazır olduğunuzda bilgi kontrolüne geçin/);
  assert.match(controller,/Sinbad açıklamayı tamamlayamadı\. Başarı kaydı oluşturulmadı/);
  assert.match(controller,/new MutationObserver\(observeTeachingReply\)/);
  assert.match(controller,/advance\(state\.session,loadProfile\(\),\{type:'ASSESSMENT'/);
  assert.match(controller,/advance\(state\.session,loadProfile\(\),\{type\}/);
});

test('tutor safely restores a valid local session and discards an invalid one',()=>{
  const controller=fs.readFileSync('sinbad-tutor-controller.js','utf8');
  assert.match(controller,/SinbadTutorOrchestrator\.restore/);
  assert.match(controller,/localStorage\.removeItem\(SESSION_KEY\)/);
  assert.match(controller,/geri yüklendi/);
  assert.match(controller,/doğrulanamadı/);
});

test('active tutor progress cannot be silently overwritten and abandonment is explicit',()=>{
  const controller=fs.readFileSync('sinbad-tutor-controller.js','utf8');
  assert.match(controller,/state\?\.session\?\.status==='ACTIVE'/);
  assert.match(controller,/Etkin oturum korunuyor/);
  assert.match(controller,/confirm\('Bu rehberli oturumu bırakmak istiyor musunuz\?/);
  assert.match(controller,/abandonTutorSession.*addEventListener\('click',abandon\)/);
  assert.match(controller,/Doğrulanmış öğrenme profiliniz korunuyor/);
  assert.doesNotMatch(controller,/pendingTeaching=null;\$\('startTutorSession'\)\.disabled=false/);
});

test('tutor progress UI exposes only assessed objective completion',()=>{
  const controller=fs.readFileSync('sinbad-tutor-controller.js','utf8');
  assert.match(controller,/SinbadTutorOrchestrator\.progress\(state\.session\)/);
  assert.match(controller,/hedef doğrulandı/);
  assert.match(controller,/item\.status==='VERIFIED'/);
  assert.match(controller,/renderProgress\(\)/);
});

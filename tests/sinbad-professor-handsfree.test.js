const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('academy-professor-v3.html','utf8');
const app=fs.readFileSync('academy-professor-handsfree.js','utf8');
const main=fs.readFileSync('app.js','utf8');
const release=fs.readFileSync('tools/build-pages-artifact.js','utf8');

test('hands-free Professor composes the frozen Phase 1 and Phase 2 layers',()=>{
  assert.match(html,/id="phaseOneClassroom" src="\.\/academy\.html"/);
  assert.match(html,/sinbad-professor\.js\?v=82019/);
  assert.match(html,/academy-professor\.js\?v=82019/);
  assert.match(html,/academy-professor-handsfree\.js/);
});

test('hands-free mode is explicit, stoppable and never stores audio',()=>{
  assert.match(html,/id="toggleHandsFree"[^>]*aria-pressed="false"/);
  assert.match(html,/Ses kaydı saklanmaz/);
  assert.match(app,/window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(app,/function stopRecognition\(\)/);
  assert.match(app,/recognition\.abort\(\)/);
  assert.doesNotMatch(app,/MediaRecorder|audioChunks|getUserMedia/);
});

test('recognized final speech becomes a normal classroom question',()=>{
  assert.match(app,/recognition\.onresult/);
  assert.match(app,/if\(event\.results\[i\]\.isFinal\)lastFinal\+=text/);
  assert.match(app,/input\.value=clean/);
  assert.match(app,/form\.requestSubmit\(\)/);
});

test('turn-taking prevents Sinbad speech from feeding back into recognition',()=>{
  assert.match(app,/sinbadIsSpeaking\(\)/);
  assert.match(app,/awaitingAnswer=true;stopRecognition\(\)/);
  assert.match(app,/stage\.dataset\.state==='speaking'/);
  assert.match(app,/const deadline=Date\.now\(\)\+8000/);
  assert.match(app,/awaitingAnswer=false/);
  assert.match(app,/scheduleListening\(250\)/);
});

test('main app opens the resizable hands-free Professor window and Pages ships its assets',()=>{
  assert.match(main,/window\.open\('\.\/academy-professor-v3\.html','sinbadProfessorWorkspace'/);
  assert.match(main,/resizable=yes/);
  for(const file of ['academy-professor-v3.html','academy-professor-handsfree.css','academy-professor-handsfree.js'])assert.match(release,new RegExp(file.replaceAll('.','\\.')));
});

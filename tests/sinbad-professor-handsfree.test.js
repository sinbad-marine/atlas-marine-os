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
  assert.match(app,/deadline=Date\.now\(\)\+8000/);
  assert.match(app,/awaitingAnswer=false/);
  assert.match(app,/scheduleListening\(250\)/);
});

test('student can interrupt narration with a name-gated barge-in question',()=>{
  assert.match(html,/araya girmek için “Sinbad…” diye başlayın/);
  assert.match(app,/function startInterruptionListening\(\)/);
  assert.match(app,/function isInterruption\(text\)/);
  assert.match(app,/sinbad\|simbad\|sinbat\|sin bat\|isim bat/);
  assert.match(app,/function interruptSinbad\(text\)/);
  assert.match(app,/academyStopVoice/);
  assert.match(app,/listeningPurpose==='interrupt'/);
  assert.match(app,/answerTurn!==turnGeneration/);
  assert.match(app,/function armBargeIn\(text\)/);
  assert.match(app,/Sizi duydum; anlatımı durdurdum/);
  assert.match(app,/scheduleBargeInFinish/);
  assert.match(app,/bargeTimer=setTimeout/);
  assert.match(app,/lastFinal\.trim\(\)\|\|liveTranscript\.trim\(\)/);
});

test('main app opens the resizable hands-free Professor window and Pages ships its assets',()=>{
  assert.match(main,/window\.open\('\.\/academy-professor-native\.html','sinbadProfessorClassroom'/);
  assert.match(main,/resizable=yes/);
  for(const file of ['academy-professor-v3.html','academy-professor-handsfree.css','academy-professor-handsfree.js','academy-professor-native.html','academy-professor-native.css','academy-professor-native.js'])assert.match(release,new RegExp(file.replaceAll('.','\\.')));
});

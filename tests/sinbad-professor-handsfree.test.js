const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('academy-professor-v3.html','utf8');
const nativeHtml=fs.readFileSync('academy-professor-native.html','utf8');
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
  assert.match(app,/if\(event\.results\[i\]\.isFinal\)lastFinal\+=`\$\{text\} `/);
  assert.match(app,/input\.value=clean/);
  assert.match(app,/form\.requestSubmit\(\)/);
});

test('turn-taking prevents Sinbad speech from feeding back into recognition',()=>{
  assert.match(app,/sinbadIsSpeaking\(\)/);
  assert.match(app,/awaitingAnswer=true;disarmWake\(\);stopRecognition\(\)/);
  assert.match(app,/stage\.dataset\.state==='speaking'/);
  assert.match(app,/deadline=Date\.now\(\)\+3000/);
  assert.match(app,/awaitingAnswer=false/);
  assert.match(app,/scheduleListening\(80\)/);
});

test('only Captain Sinbad wakes the sleeping microphone and ambient speech is ignored',()=>{
  assert.match(app,/function wakeMatch\(text\)/);
  assert.match(app,/kaptan\|kapitan/);
  assert.match(app,/sinbad\|simbad\|sinbat\|sin bat\|isim bat/);
  assert.match(app,/if\(!wakeArmed&&hasWakePhrase\(heard\)\)/);
  assert.match(app,/if\(!wakeArmed\)\{setStatus\([^}]+return\}/);
  assert.match(app,/questionAfterWake\(heard\)/);
  assert.match(app,/Uyku modundayım/);
});

test('speech is submitted only after the user finishes and client restart delays are short',()=>{
  assert.match(app,/END_OF_SPEECH_MS=900/);
  assert.match(app,/recognition\.continuous=true/);
  assert.match(app,/function finishAfterSilence\(\)/);
  assert.match(app,/clearTimer\('silence'\)/);
  assert.match(app,/if\(listening&&wakeArmed\)/);
  assert.match(app,/recognition\.onend=/);
  assert.match(app,/if\(wakeArmed&&question\)return submitTranscript\(question\)/);
  assert.match(app,/scheduleListening\(80\)/);
});

test('student can interrupt narration only with the full wake phrase',()=>{
  assert.match(nativeHtml,/“Kaptan Sinbad” denince uyanır/);
  assert.match(app,/function startInterruptionListening\(\)/);
  assert.match(app,/listeningPurpose==='interrupt'/);
  assert.match(app,/hasWakePhrase\(heard\)/);
  assert.match(app,/academyStopVoice/);
  assert.match(app,/answerTurn!==turnGeneration/);
  assert.match(app,/Sizi duydum; anlatımı durdurdum/);
});

test('main app opens the resizable hands-free Professor window and Pages ships its assets',()=>{
  assert.match(main,/window\.open\('\.\/academy-professor-native\.html','sinbadProfessorClassroom'/);
  assert.match(main,/resizable=yes/);
  for(const file of ['academy-professor-v3.html','academy-professor-handsfree.css','academy-professor-handsfree.js','academy-professor-native.html','academy-professor-native.css','academy-professor-native.js','sinbad-speaker-identity.js'])assert.match(release,new RegExp(file.replaceAll('.','\\.')));
});

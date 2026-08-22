const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const academyHtml=fs.readFileSync('academy.html','utf8');
const academyCss=fs.readFileSync('academy.css','utf8');
const academyApp=fs.readFileSync('academy-window.js','utf8');
const worker=fs.readFileSync('sw.js','utf8');

test('Academy launches as a genuine separate resizable browser window',()=>{
  assert.match(html,/id="openSinbadAcademyClassroom"/);
  assert.doesNotMatch(html,/id="sinbadAcademyWindow"/);
  assert.match(app,/window\.open\('\.\/academy\.html','sinbadAcademyClassroom'/);
  assert.match(app,/popup=yes/);
  assert.match(app,/resizable=yes/);
  assert.match(app,/scrollbars=yes/);
  assert.match(app,/screen\.availWidth/);
  assert.match(app,/screen\.availHeight/);
});

test('standalone classroom owns its full viewport and preserves native window geometry',()=>{
  assert.match(academyHtml,/<title>Sinbad Academy — Classroom<\/title>/);
  assert.match(academyHtml,/id="academyModule"/);
  assert.match(academyHtml,/id="academyOutput"/);
  assert.match(academyHtml,/id="closeAcademyWindow"/);
  assert.match(academyCss,/\.academy-shell\{height:100vh/);
  assert.match(academyApp,/window\.resizeTo\(width,height\)/);
  assert.match(academyApp,/window\.moveTo\(/);
  assert.match(academyApp,/window\.outerWidth/);
  assert.match(academyApp,/window\.outerHeight/);
  assert.match(academyApp,/window\.close\(\)/);
  assert.match(worker,/'\.\/academy\.html'/);
  assert.match(worker,/pageKey=url\.pathname\.endsWith\('\/academy\.html'\)/);
});

test('standalone Academy retains course and quiz handlers',()=>{
  assert.match(academyApp,/startAcademyLesson/);
  assert.match(academyApp,/startAcademyQuiz/);
  assert.match(academyApp,/function renderLesson\(\)/);
  assert.match(academyApp,/function renderQuiz\(\)/);
});

test('standalone Academy is a live free-form voice and text classroom, not a required topic menu',()=>{
  assert.match(academyHtml,/id="academyChatForm"/);
  assert.match(academyHtml,/id="academyQuestion"/);
  assert.match(academyHtml,/id="academyMic"/);
  assert.match(academyHtml,/Optional guided lesson shortcuts — no selection required/);
  assert.match(academyApp,/async function askSinbad\(question\)/);
  assert.match(academyApp,/functions\.invoke\('sinbad-answer'/);
  assert.match(academyApp,/includeSourceVisuals:true/);
  assert.match(academyApp,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(academyApp,/academyChatForm/);
});

test('Captain Sinbad teaches with real state art, browser voice and verified source-page visuals',()=>{
  assert.match(academyHtml,/id="academySinbadAvatar"/);
  assert.match(academyHtml,/id="academyVoiceToggle"/);
  assert.match(academyHtml,/id="academyReplayVoice"/);
  assert.match(academyHtml,/id="academyStopVoice"/);
  assert.match(academyApp,/captain-sinbad-board-teaching\.png/);
  assert.match(academyApp,/captain-sinbad-speaking\.png/);
  assert.match(academyApp,/captain-sinbad-listening\.png/);
  assert.match(academyApp,/new SpeechSynthesisUtterance/);
  assert.match(academyApp,/function renderVisuals\(visuals\)/);
  assert.match(academyApp,/cloudClient\.storage\.from\(doc\.bucket_id\)\.download/);
  assert.match(academyApp,/#page=\$\{Math\.max/);
  assert.match(academyCss,/\[data-state="speaking"\]/);
  assert.match(academyCss,/@media\(prefers-reduced-motion:reduce\)/);
});

test('live Academy instructor is driven by the bounded character engine',()=>{
  assert.match(academyHtml,/id="academyInstructorStage"/);
  assert.match(academyHtml,/sinbad-character-engine\.js\?v=82019/);
  assert.match(academyHtml,/sinbad-character-rig\.js\?v=82019/);
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82019/);
  assert.match(academyApp,/createCharacterEngine\(\{initialState:'idle'\}\)/);
  assert.match(academyApp,/academyCharacterEngine\.setState\(safeState\)/);
  assert.match(academyApp,/SinbadCharacterRig\?\.poseForState/);
  assert.match(academyCss,/\[data-gesture="listen-lean"\]/);
});

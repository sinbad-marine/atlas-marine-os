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

test('native Academy owns a bounded live Sinbad board-teaching stage',()=>{
  assert.match(academyHtml,/id="academyTeachingStage"/);assert.match(academyHtml,/captain-sinbad-board-teaching\.png/);
  assert.match(academyHtml,/sinbad-character-engine\.js\?v=82017/);
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82018/);assert.match(academyHtml,/academy-window\.js\?v=82019/);assert.match(academyHtml,/academy\.css\?v=82019/);
  assert.match(academyApp,/function teachLessonAtBoard\(lesson\)/);
  assert.match(academyApp,/\.join\('\\n\\n'\)\.slice\(0,500\)/);
  assert.match(academyApp,/const event=cue\.state==='walking'\?'WALK':'TEACH_AT_BOARD'/);
  assert.match(academyApp,/academyPerformanceDirector\?\.play\('lesson-opening'/);
  assert.match(academyApp,/captain-sinbad-walk-a-v1\.png/);assert.match(academyApp,/captain-sinbad-walk-b-v1\.png/);
  assert.match(academyApp,/setTimeout\(\(\)=>\{if\(generation===academyBoardGeneration\)writeNext\(\);\},1680\)/);
  assert.match(academyApp,/generation!==academyBoardGeneration/);
  assert.match(academyApp,/function stopBoardTeaching\(\)/);
  assert.match(academyCss,/\.academy-teaching-stage\[hidden\]\{display:none\}/);
  assert.match(academyCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(academyCss,/\.academy-sinbad\[data-state="walking"\] img\{animation:none/);
  assert.match(worker,/sinbad-marine-v8\.20\.17-live-character-board-writing-v3/);
});

test('board writing progress drives a real chalk cursor and bounded character direction cues',()=>{
  assert.match(academyApp,/function renderAcademyBoardProgress\(board,text,index,finished=false\)/);
  assert.match(academyApp,/document\.createTextNode\(text\.slice\(0,index\)\)/);
  assert.match(academyApp,/cursor\.className='academy-chalk-cursor'/);
  assert.match(academyApp,/function directAcademyWritingGesture\(index,text,lastCueBucket\)/);
  assert.match(academyApp,/const cueBucket=Math\.floor\(index\/42\)/);
  assert.match(academyApp,/audienceTurn\?'explain':'point-board'/);
  assert.match(academyApp,/renderAcademyBoardProgress\(board,text,index,index>=text\.length\)/);
  assert.match(academyApp,/querySelector\('\.academy-chalk-cursor'\)\?\.remove\(\)/);
  assert.match(academyCss,/\.academy-chalk-cursor\{/);assert.match(academyCss,/@keyframes academyChalkPulse/);
});

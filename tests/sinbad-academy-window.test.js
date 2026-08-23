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
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82018/);assert.match(academyHtml,/academy-window\.js\?v=82021/);assert.match(academyHtml,/academy\.css\?v=82019/);
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
  assert.match(worker,/sinbad-marine-v8\.20\.17-speech-aware-visemes-v26/);
});

test('board writing progress drives a real chalk cursor and bounded character direction cues',()=>{
  assert.match(academyApp,/function renderAcademyBoardProgress\(board,text,index,finished=false\)/);
  assert.match(academyApp,/document\.createTextNode\(text\.slice\(0,index\)\)/);
  assert.match(academyApp,/cursor\.className='academy-chalk-cursor'/);
  assert.match(academyApp,/function directAcademyWritingGesture\(index,text,lastCueBucket\)/);
  assert.match(academyApp,/const cueBucket=Math\.floor\(index\/42\)/);
  assert.match(academyApp,/audienceTurn\?'explain':'point-board'/);
  assert.match(academyApp,/academyCharacterEngine\?\.dispatch\('TEACH_AT_BOARD',\{boardText:text,gesture:/);
  assert.match(academyApp,/renderAcademyBoardProgress\(board,text,index,index>=text\.length\)/);
  assert.match(academyApp,/querySelector\('\.academy-chalk-cursor'\)\?\.remove\(\)/);
  assert.match(academyCss,/\.academy-chalk-cursor\{/);assert.match(academyCss,/@keyframes academyChalkPulse/);
});

test('real transparent writing frames follow measured board progress and settle to explanation',()=>{
  for(const file of ['captain-sinbad-writing-contact-v1.png','captain-sinbad-writing-lift-v1.png']){
    const path=`assets/captain-sinbad/${file}`,bytes=fs.readFileSync(path);assert.equal(bytes.toString('ascii',1,4),'PNG');assert.equal(bytes[25],6);assert.match(worker,new RegExp(file.replaceAll('.','\\.')));
  }
  assert.match(academyApp,/writing:Object\.freeze\(\{ready:'\.\/assets\/captain-sinbad\/captain-sinbad-board-teaching\.png',contact:'\.\/assets\/captain-sinbad\/captain-sinbad-writing-contact-v1\.png',lift:'\.\/assets\/captain-sinbad\/captain-sinbad-writing-lift-v1\.png'\}\)/);
  assert.match(academyApp,/function preloadAcademyCharacterAssets\(\)/);
  assert.match(academyApp,/function academyWritingFrameKey\(index,text\)/);
  assert.match(academyApp,/if\(\/\[\.!\?;:\]\/u\.test\(character\)\)return 'ready'/);
  assert.match(academyApp,/if\(\/\\s\/u\.test\(character\)\)return 'lift'/);
  assert.match(academyApp,/Math\.floor\(index\/3\)%2===0\?'contact':'lift'/);
  assert.match(academyApp,/function renderAcademyWritingFrame\(index,text,lastFrameKey\)/);
  assert.match(academyApp,/ACADEMY_CHARACTER_ASSETS\.writing\[frameKey\]/);
  assert.match(academyApp,/setTimeout\(writeNext,\/\\s\/\.test\(text\[index\]\|\|''\)\?55:/);
  assert.match(academyApp,/else renderAcademyCharacterCue\(\{state:'board-teaching',gesture:'explain',gaze:'audience'\},text\)/);
});

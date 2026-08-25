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
  assert.match(academyHtml,/sinbad-character-engine\.js\?v=82029/);
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82029/);assert.match(academyHtml,/academy-window\.js\?v=82029/);assert.match(academyHtml,/academy\.css\?v=82019/);
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
  assert.match(worker,/sinbad-marine-v8\.20\.29-semantic-motion-bridges-v42/);
});

test('standalone Academy is a live free-form voice and text classroom, not a required topic menu',()=>{
  assert.match(academyHtml,/id="academyChatForm"/);
  assert.match(academyHtml,/id="academyQuestion"/);
  assert.match(academyHtml,/id="academyMic"/);
  assert.match(academyHtml,/Optional guided lesson shortcuts — no selection required/);
  assert.match(academyApp,/async function askSinbad\(question\)/);
  assert.match(academyApp,/functions\.invoke\('sinbad-answer'/);
  assert.match(academyApp,/includeSourceVisuals:false,suppressSourceVisuals:true/);
  assert.match(academyApp,/window\.SinbadVisuals\?\.select/);
  assert.match(academyApp,/SinbadVisuals\?\.select\?\.\(question,answer,\{max:1\}\)/);
  assert.match(academyApp,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(academyApp,/academyChatForm/);
});

test('Academy Core gate rejects empty and whitespace-only answers before rendering',()=>{
  assert.match(academyApp,/function coreAnswerIsTrusted\(data,envelope\)/);
  assert.match(academyApp,/String\(data\?\.answer\|\|''\)\.trim\(\)/);
  assert.match(academyApp,/SinbadCoreDecision\?\.answerIsSafe\?\.\(answer\)===true/);
  assert.match(academyApp,/spokenSummarySafe=!spokenSummary\|\|window\.SinbadCoreDecision\?\.answerIsSafe\?\.\(spokenSummary\)===true/);
  assert.match(academyApp,/data&&answerSafe&&spokenSummarySafe&&data\.coreGateVersion/);
  assert.match(academyApp,/decision\.risk===expected\.risk/);
  assert.match(academyApp,/requiresIndependentVerification/);
  assert.doesNotMatch(academyApp,/Boolean\(data\?\.answer&&/);
  assert.ok(academyApp.indexOf('if(!coreAnswerIsTrusted(data,coreEnvelope))')<academyApp.indexOf('const answer=String(data.answer).trim()'));
});

test('Captain Sinbad teaches with real state art, browser voice and verified atlas images',()=>{
  assert.match(academyHtml,/id="academySinbadAvatar"/);
  assert.match(academyHtml,/id="academyVoiceToggle"/);
  assert.match(academyHtml,/id="academyReplayVoice"/);
  assert.match(academyHtml,/id="academyStopVoice"/);
  assert.match(academyApp,/captain-sinbad-board-teaching\.png/);
  assert.match(academyApp,/captain-sinbad-speaking\.png/);
  assert.match(academyApp,/captain-sinbad-listening\.png/);
  assert.match(academyApp,/new SpeechSynthesisUtterance/);
  assert.match(academyApp,/function renderVisuals\(visuals\)/);
  assert.match(academyHtml,/sinbad-visuals\.js\?v=8235/);
  assert.match(academyApp,/academy-atlas-visual/);
  assert.match(academyApp,/visuals\.filter\(visual=>safeAsset\.test/);
  assert.doesNotMatch(academyApp,/cloudClient\.storage\.from\(doc\.bucket_id\)\.download/);
  assert.doesNotMatch(academyApp,/#page=\$\{Math\.max/);
  assert.match(academyCss,/\.academy-atlas-visual img/);
  assert.match(academyCss,/\[data-state="speaking"\]/);
});

test('board writing progress drives a real chalk cursor and bounded character direction cues',()=>{
  assert.match(academyApp,/function renderAcademyBoardProgress\(board,text,index,finished=false\)/);
  assert.match(academyApp,/document\.createTextNode\(text\.slice\(0,index\)\)/);
  assert.match(academyApp,/cursor\.className='academy-chalk-cursor'/);
  assert.match(academyApp,/function directAcademyWritingGesture\(index,text,lastCueBucket\)/);
  assert.match(academyApp,/const result=academyCharacterEngine\?\.dispatch\(event,\{boardText:text,\.\.\.cue\}\)/);
  assert.match(academyApp,/if\(!result\?\.accepted\)return false/);
  assert.match(academyApp,/const cueBucket=Math\.floor\(index\/42\)/);
  assert.match(academyApp,/audienceTurn\?'explain':'point-board'/);
  assert.match(academyApp,/academyCharacterEngine\?\.dispatch\('TEACH_AT_BOARD',\{boardText:text,gesture:/);
  assert.match(academyApp,/renderAcademyBoardProgress\(board,text,index,index>=text\.length\)/);
  assert.match(academyApp,/querySelector\('\.academy-chalk-cursor'\)\?\.remove\(\)/);
  assert.match(academyCss,/\.academy-chalk-cursor\{/);assert.match(academyCss,/@keyframes academyChalkPulse/);
});

test('main chat can send only bounded same-origin plain text to the Academy board',()=>{
  assert.match(app,/function sendTextToSinbadAcademyBoard\(text\)/);
  assert.match(app,/slice\(0,200\)/);assert.match(app,/type:'SINBAD_ACADEMY_WRITE_BOARD'/);assert.match(app,/event\.data\.type==='SINBAD_ACADEMY_READY'/);assert.match(app,/sinbadAcademyBoardQueue\.length/);assert.match(app,/requestId=`academy-board-/);assert.match(app,/event\.data\.requestId===entry\.payload\.requestId/);
  assert.match(academyApp,/function writeCustomTextAtBoard\(rawText\)/);
  assert.match(academyApp,/event\.origin!==location\.origin\|\|event\.source!==window\.opener/);
  assert.match(academyApp,/message\.text\.length<=200/);assert.match(academyApp,/writeCustomTextAtBoard\(message\.text\)/);assert.match(academyApp,/type:'SINBAD_ACADEMY_READY'/);assert.match(academyApp,/requestId:message\.requestId/);
  assert.match(app,/function sendShapeToSinbadAcademyBoard\(shape,size='standard'\)/);assert.match(academyApp,/function drawAllowedShapeAtBoard\(shape,size='standard'\)/);
  assert.match(academyApp,/dataset\.boardSize=safeSize/);assert.match(academyApp,/\['small','standard','large'\]/);
  assert.match(academyApp,/\['circle','triangle','rectangle','arrow','axes'\]\.includes\(message\.shape\)/);assert.match(academyApp,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
  for(const shape of ['triangle','rectangle','arrow','axes'])assert.match(academyApp,new RegExp(`${shape}:Object\\.freeze`));assert.match(academyApp,/svg\.dataset\.boardShape=shape/);
  assert.match(academyApp,/function animateAllowedShapeDrawing\(generation,shape,reducedMotion=false\)/);
  assert.match(academyApp,/if\(!result\?\.accepted\)\{stage\.dataset\.boardDrawingPhase='blocked';return;\}/);
  assert.match(academyApp,/\[260,'lift','write-lift','lift'\]/);assert.match(academyApp,/\[880,'contact','write-contact','contact'\]/);assert.match(academyApp,/\[1250,'ready','explain','complete','audience'\]/);
  for(const rhythm of ['steady','measured','lively'])assert.match(academyApp,new RegExp(`id:'${rhythm}'`));
  assert.match(academyApp,/function selectAcademyShapeDrawingRhythm\(\)/);assert.match(academyApp,/index>=academyLastShapeDrawingRhythm/);assert.match(academyApp,/stage\.dataset\.boardDrawingRhythm=rhythm\.id/);
  assert.equal((academyApp.match(/'check-in','audience'/g)||[]).length,3);
  assert.match(academyApp,/type:'SINBAD_ACADEMY_BOARD_APPLIED'/);assert.match(app,/event\.data\.type==='SINBAD_ACADEMY_BOARD_APPLIED'/);
  assert.match(app,/academyBoardRecallAnswerForText\?\.\(q,sinbadLastAcademyBoardAction/);
  assert.match(academyApp,/function clearAcademyBoard\(onApplied\)/);assert.match(academyApp,/type==='SINBAD_ACADEMY_CLEAR_BOARD'/);assert.match(app,/function clearSinbadAcademyBoard\(\)/);
  assert.match(app,/action\.kind==='clear'.*sinbadLastAcademyBoardAction=null/);
  assert.match(academyApp,/boardDrawingPhase='erasing'/);assert.match(academyApp,/setTimeout\(finish,620\)/);assert.match(academyApp,/clearAcademyBoard\(\(\)=>window\.opener\.postMessage/);
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

test('live Academy instructor is driven by the bounded character engine',()=>{
  assert.match(academyHtml,/id="academyInstructorStage"/);
  assert.match(academyHtml,/sinbad-character-engine\.js\?v=82029/);
  assert.match(academyHtml,/sinbad-character-rig\.js\?v=82029/);
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82029/);
  assert.match(academyApp,/createCharacterEngine\(\{initialState:'idle'\}\)/);
  assert.match(academyApp,/academyCharacterEngine\.setState\(safeState\)/);
  assert.match(academyApp,/SinbadCharacterRig\?\.poseForState/);
  assert.match(academyCss,/\[data-gesture="listen-lean"\]/);
});

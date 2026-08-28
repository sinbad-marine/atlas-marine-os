const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const academyHtml=fs.readFileSync('academy.html','utf8');
const academyCss=fs.readFileSync('academy.css','utf8');
const academyApp=fs.readFileSync('academy-classroom-window.js','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');

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

test('dashboard exposes one Academy and its four programmes stay inside that window',()=>{
  assert.equal((html.match(/id="openSinbadAcademyClassroom"/g)||[]).length,1);
  assert.match(html,/id="openSinbadAcademyHomeCard"[^>]*data-open-sinbad-academy/);
  assert.equal((html.match(/data-open-sinbad-academy/g)||[]).length,2);
  assert.match(app,/document\.querySelectorAll\('\[data-open-sinbad-academy\]'\)/);
  assert.doesNotMatch(html,/data-academy-track=/);
  for(const section of ['goss-gasm','stcw','goc','general-maritime-education'])assert.match(academyHtml,new RegExp(`data-academy-section="${section}"`));
  assert.match(academyApp,/const ACADEMY_SECTIONS=Object\.freeze/);
  assert.match(academyApp,/const GEOMETRY_KEY='atlas_sinbad_academy_native_window'/);
});

test('standalone classroom owns its full viewport and preserves native window geometry',()=>{
  assert.match(academyHtml,/<title>Sinbad Academy — Classroom<\/title>/);
  assert.match(academyHtml,/id="academyModule"/);
  assert.match(academyHtml,/id="academyOutput"/);
  assert.match(academyHtml,/value="gasm-seyir-sinav"/);
  assert.match(academyHtml,/value="stcw-foundation"/);
  assert.match(academyHtml,/value="goc-foundation"/);
  assert.match(academyHtml,/value="general-maritime-education"/);
  assert.match(academyApp,/item\.kind==='source-page'/);
  assert.match(academyApp,/Cevap anahtarı bekleniyor/);
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

test('native Academy owns a persistent full-body Sinbad classroom stage',()=>{
  assert.match(academyHtml,/id="academyTeachingStage"/);assert.match(academyHtml,/captain-sinbad-board-teaching\.png/);
  assert.match(academyHtml,/sinbad-character-engine\.js\?v=82030/);
  assert.match(academyHtml,/sinbad-performance-director\.js\?v=82082/);assert.match(academyHtml,/academy-classroom-window\.js\?v=82104/);assert.match(academyHtml,/academy\.css\?v=82097/);
  assert.doesNotMatch(academyHtml,/id="academyTeachingStage"[^>]*hidden/);
  assert.ok(academyHtml.indexOf('id="academyModule"')<academyHtml.indexOf('</aside>'),'training controls belong to the left classroom column');
  assert.match(academyHtml,/id="academyTrackTitle" hidden/);
  assert.match(academyApp,/function teachLessonAtBoard\(lesson\)/);
  assert.match(academyApp,/\.join\('\\n\\n'\)\.slice\(0,500\)/);
  assert.match(academyApp,/cue\.state==='walking'\?'WALK':cue\.state==='listening'\?'LISTEN_STARTED'/);
  assert.match(academyApp,/renderAcademyBoardProgress\(board,text,index,index>=text\.length\)/);
  assert.doesNotMatch(academyApp,/function teachLessonAtBoard\(lesson\)[\s\S]*?academyPerformanceDirector\?\.play\('lesson-opening'/);
  assert.match(academyApp,/captain-sinbad-walk-a-v1\.png/);assert.match(academyApp,/captain-sinbad-walk-b-v1\.png/);
  assert.match(academyApp,/setTimeout\(writeNext,240\)/);
  assert.match(academyApp,/generation!==academyBoardGeneration/);
  assert.match(academyApp,/function stopBoardTeaching\(\)/);
  assert.match(academyCss,/\.academy-teaching-stage\{position:relative;width:100%;height:100%;min-height:560px/);
  assert.match(academyCss,/linear-gradient\(180deg,#d9d3c3 0 84%,#856c50 84% 86%,#594838 86% 100%\)/);
  assert.match(academyCss,/\.academy-live-board\{position:absolute;z-index:1;left:17%;top:21%;width:81%;height:39%/);
  assert.match(academyCss,/\.academy-sinbad\{position:absolute;z-index:3;left:0;bottom:\.5%/);
  assert.doesNotMatch(academyCss,/\.academy-sinbad\{[^}]*right:0/);
  assert.match(academyCss,/object-position:center bottom/);
  assert.match(academyCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(academyCss,/\.academy-sinbad\[data-state="walking"\] img\{animation:academyWalkCycle/);
  assert.match(academyApp,/const ACADEMY_FULL_BODY_RIG_CALIBRATED=false/);
  for(const part of ['head','torso','left-arm','right-arm'])assert.match(academyHtml,new RegExp(`captain-sinbad-fullbody-rig-${part}-v2\\.png`));
  assert.match(academyCss,/\.academy-rig-torso\{[^}]*height:74%/);
  assert.match(worker,/sinbad-marine-v8\.20\.29-academy-classroom-v120/);
});

test('GOSS GASM exposes qualification, mandatory subject, topic and one-question test navigation',()=>{
  assert.match(academyHtml,/id="gasmMenuButton"/);
  assert.match(academyHtml,/id="gasmQualificationMenu"/);
  assert.match(academyHtml,/academy-gasm-catalog\.js\?v=1/);
  assert.match(worker,/'\.\/academy-gasm-catalog\.js'/);
  assert.match(academyApp,/function renderGasmQualificationMenu\(\)/);
  assert.match(academyApp,/function selectGasmSubject\(/);
  assert.match(academyApp,/function renderGasmTest\(\)/);
  assert.match(academyApp,/function handleAcademySectionClick\(button\)/);
  assert.match(academyApp,/Arşiv sorusu henüz yok/);
  assert.match(academyApp,/insan doğrulaması tamamlanmadan kesin doğru\/yanlış sonucu gösterilmez/);
  assert.match(academyHtml,/id="openOwnerQuestionReview"/);
  assert.match(academyApp,/SINBAD_OWNER_REVIEW_URL='http:\/\/127\.0\.0\.1:4177\/'/);
  assert.match(academyApp,/function openOwnerQuestionReview\(\)/);
});

test('student Academy never renders the verified GASM answer key',()=>{
  assert.match(academyApp,/Doğrulanmış cevap anahtarı yalnız yetkili Owner inceleme ekranında gösterilir/);
  assert.doesNotMatch(academyApp,/Object\.entries\(item\.answers\)/);
  assert.doesNotMatch(academyApp,/Doğrulanmış resmî cevap anahtarı ·/);
});

test('Academy keeps only classroom scenery on the right and dialogue in the left control rail',()=>{
  const asideEnd=academyHtml.indexOf('</aside>'),mainStart=academyHtml.indexOf('<main class="academy-main">');
  assert.ok(academyHtml.indexOf('class="academy-conversation"')<asideEnd);
  assert.ok(academyHtml.indexOf('id="academyOutput"')>mainStart);
  assert.doesNotMatch(academyHtml,/class="academy-emblem"/);
  assert.doesNotMatch(academyHtml,/Offline-ready lessons/);
  assert.match(academyHtml,/id="academyOutput"[^>]*hidden/);
  assert.match(academyApp,/output\.replaceChildren\(\);output\.hidden=true/);
  assert.match(academyCss,/\.academy-section-nav button\{[^}]*font-size:\.78rem/);
});

test('Academy transitions from the Sinbad welcome scene to a full-board lesson workspace',()=>{
  assert.match(academyHtml,/id="academyTeachingStage" class="academy-teaching-stage" data-phase="welcome"/);
  assert.match(academyApp,/function setAcademyClassroomPhase\(phase\)/);
  assert.match(academyApp,/setAcademyClassroomPhase\('lesson'\);title\.textContent=lesson\.title/);
  assert.match(academyApp,/function presentAcademyAnswerOnBoard\(question,answer\)/);
  assert.match(academyApp,/presentAcademyAnswerOnBoard\(question,answer\)/);
  assert.match(academyCss,/\.academy-teaching-stage\[data-phase="lesson"\].*\.academy-sinbad\{display:none\}/);
  assert.match(academyCss,/\.academy-teaching-stage\[data-phase="lesson"\] \.academy-live-board\{inset:18px/);
});

test('Professor Sinbad classroom provides bounded text, one-shot voice and hands-free questions',()=>{
  for(const id of ['academyConversation','academyQuestionInput','askAcademyQuestion','startAcademyListening','stopAcademyListening','toggleAcademyHandsFree'])assert.match(academyHtml,new RegExp(`id="${id}"`));
  assert.match(academyApp,/function answerAcademyQuestion\(\)/);
  assert.match(academyApp,/SinbadAcademy\?\.answer\(question,window\.SINBAD_TRAINING_DATA\)/);
  assert.match(academyApp,/Tahmin üretmeyeceğim/);
  assert.match(academyApp,/window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(academyApp,/academyRecognition\.continuous=academyHandsFreeEnabled/);
  assert.match(academyApp,/function setAcademyHandsFree\(enabled\)/);
  assert.match(academyApp,/scheduleAcademyHandsFreeListening\(650\)/);
  assert.match(academyApp,/Eller serbest: Açık/);
});

test('Professor Sinbad drives real bounded mouth frames from speech events',()=>{
  assert.match(academyApp,/captain-sinbad-speaking-mbp-v1\.png/);
  assert.match(academyApp,/captain-sinbad-speaking-o-v1\.png/);
  assert.match(academyApp,/function academyMouthFrameForText\(text,index=0\)/);
  assert.match(academyApp,/utterance\.onboundary=event=>/);
  assert.match(academyApp,/startAcademyLipSync\(text\)/);
  assert.match(academyApp,/stopAcademyLipSync\(\)/);
  assert.match(academyApp,/prefers-reduced-motion: reduce/);
});

test('Professor Sinbad changes bounded body meaning at real speech boundaries',()=>{
  assert.match(academyApp,/speechCueForBoundary\?\.\(\{text,name:event\.name\|\|'word',charIndex,wordIndex,mode:'warm'\}\)/);
  assert.match(academyApp,/academySpeechGestureDirector\?\.select\?\.\(boundary\.cue\)/);
  assert.match(academyApp,/if\(selected\?\.change&&selected\.cue\?\.gesture\)renderAcademyCharacterCue\(\{state:'speaking',\.\.\.selected\.cue\}/);
  assert.match(academyApp,/avatar\.dataset\.emotion=snapshot\.emotion\|\|'neutral'/);
  assert.match(academyCss,/data-state="speaking"\]\[data-gesture="hold"/);
  assert.match(academyCss,/data-state="speaking"\]\[data-gesture="nod"/);
  assert.match(academyCss,/data-emotion="concerned"/);
});

test('Professor Sinbad blinks at bounded non-sequential idle intervals only in the welcome scene',()=>{
  assert.match(academyApp,/idleBlink:'\.\/assets\/captain-sinbad\/captain-sinbad-idle-blink-v1\.png'/);
  assert.match(academyApp,/function academyIdleBlinkDelay\(\)/);
  assert.match(academyApp,/window\.crypto\?\.getRandomValues\?\.\(entropy\)/);
  assert.match(academyApp,/return 3600\+.*%3601/);
  assert.match(academyApp,/stage\?\.dataset\.phase!=='welcome'/);
  assert.match(academyApp,/avatar\?\.dataset\.state!=='idle'/);
  assert.match(academyApp,/prefers-reduced-motion: reduce/);
  assert.match(academyApp,/stopAcademyIdleBlink\(\).*scheduleAcademyIdleBlink\(\)/s);
});

test('Professor Sinbad answers bounded social greetings without pretending they need an academic source',()=>{
  assert.match(academyApp,/function answerAcademySocialTurn\(question\)/);
  assert.match(academyApp,/new Set\(\['selam','merhaba','günaydın','iyi günler','iyi akşamlar'/);
  assert.match(academyApp,/foundationAnswer=academyMaritimeFoundationAnswer\(question\)/);
  assert.match(academyApp,/Sinbad Academy sınıfına hoş geldiniz/);
  assert.doesNotMatch(academyApp,/greetings\.has\(normalized\).*doğrulanmış kaynak/s);
});

test('Academy lesson clock measures only an explicitly opened lesson',()=>{
  assert.match(academyHtml,/class="academy-lesson-clock" role="timer"/);
  assert.match(academyHtml,/id="academyLessonElapsed" datetime="PT0S">00:00/);
  assert.match(academyApp,/function startAcademyLessonClock\(\)/);
  assert.match(academyApp,/academyLessonStartedAt=Date\.now\(\)/);
  assert.match(academyApp,/startAcademyLessonClock\(\);teachLessonAtBoard\(lesson\)/);
  assert.match(academyApp,/stopBoardTeaching\(\);resetAcademyLessonClock\(\)/);
  assert.match(academyCss,/\.academy-lesson-clock\{position:absolute;z-index:2/);
});

test('Academy exposes and uses the owner-local AI and library while driving the real character',()=>{
  assert.match(academyApp,/const SINBAD_BRIDGE_URL='http:\/\/127\.0\.0\.1:31983'/);
  assert.match(academyApp,/async function academyLocalAiAnswer\(question,academyEvidence='',useOwnerLibrary=false\)/);
  assert.match(academyApp,/fetch\(`\$\{SINBAD_BRIDGE_URL\}\/ai\/chat`/);
  assert.match(academyApp,/slice\(0,1200\)/);assert.match(academyApp,/academyDialogueHistory\(\)/);assert.match(academyApp,/slice\(-10\)/);
  assert.match(academyApp,/useLibrary:useOwnerLibrary/);
  assert.match(academyApp,/libraryQuery:String\(question\)\.slice\(0,1200\)/);
  assert.match(academyApp,/language:academyLanguage\(\)/);
  assert.match(academyApp,/matchingVoice=speechSynthesis\.getVoices\(\)\.find/);
  assert.match(academyApp,/academyRecognition\.lang=academyLanguage\(\)/);
  assert.match(academyHtml,/id="academyLanguage"/);
  for(const language of ['tr-TR','en-US','de-DE'])assert.match(academyHtml,new RegExp(`value="${language}"`));
  assert.match(academyApp,/history:useOwnerLibrary\?\[\]:academyDialogueHistory\(\)/);
  assert.match(academyApp,/ownerLibrary:useOwnerLibrary/);
  assert.match(academyApp,/controller\.abort\(\),120000/);
  assert.match(academyApp,/shouldUseAcademySources\(question\)/);
  assert.match(academyApp,/function academyCharacterCapabilityAnswer\(question\)/);
  assert.match(academyApp,/Sola veya sağa dönebilir/);
  assert.match(academyApp,/function academyMaritimeFoundationAnswer\(question\)/);
  assert.match(academyApp,/Gemilerden Kaynaklanan Kirliliğin Önlenmesi Uluslararası Sözleşmesi/);
  assert.match(academyApp,/const localAnswer=capabilityAnswer\|\|foundationAnswer\|\|socialAnswer\?null:/);
  assert.match(academyApp,/denizcilik\|seyir\|harita/);
  assert.match(academyApp,/gestureRequestForText\?\.\(question,\{lastAction:academyLastPerformedGestureAction\}\)/);
  assert.match(academyApp,/renderAcademyCharacterCue\(\{state:'thinking',gesture:'hold',gaze:'thought'\},question\)/);
  assert.match(academyApp,/createSpeechGestureDirector/);
  assert.match(academyCss,/@keyframes academyWave/);assert.match(academyCss,/@keyframes academySpeak/);
  assert.match(academyApp,/yerel Sinbad AI bu isteğe yanıt veremedi/);
  for(const id of ['academyAiConnection','academyLibraryConnection'])assert.match(academyHtml,new RegExp(`id="${id}"`));
  assert.match(academyApp,/async function refreshAcademyRuntimeStatus\(\)/);
  assert.match(academyApp,/fetch\(`\$\{SINBAD_BRIDGE_URL\}\/status`/);
  assert.match(academyApp,/library\.documents/);assert.match(academyApp,/library\.chunks/);
  assert.match(academyApp,/updateAcademyRuntimePill\('academyAiConnection',`Yerel AI bağlı · \$\{model\}`\)/);
  assert.match(academyApp,/if\(useOwnerLibrary\)refreshAcademyRuntimeStatus\(\)/);
});

test('Academy has explicit back and main dashboard navigation',()=>{
  assert.match(academyHtml,/id="academyBackButton"/);assert.match(academyHtml,/id="academyHomeButton"/);
  assert.match(academyApp,/const marineHome=new URL\('\.\/index\.html',window\.location\.href\)\.href/);
  assert.match(academyApp,/window\.opener\.location\.assign\(marineHome\)/);
  assert.match(academyApp,/window\.location\.assign\(marineHome\)/);
  assert.match(academyApp,/function returnToAcademyHome\(\)/);assert.match(academyApp,/window\.opener\.focus\(\)/);
  assert.match(academyApp,/function goBackFromAcademy\(\)/);
  assert.match(academyCss,/\.academy-window-navigation\{/);
});

test('local Bridge permits only the production site and loopback Academy origins',()=>{
  assert.match(bridge,/Test-AllowedBrowserOrigin/);
  assert.match(bridge,/https:\/\/sinbad-marine\.github\.io/);
  assert.match(bridge,/127\\\.0\\\.0\\\.1\|localhost/);
  assert.match(bridge,/AI_CHAT_ORIGIN_DENIED/);
  assert.match(bridge,/Get-LocalLibraryContext \$question/);
  assert.match(bridge,/LOCAL_AI_ENDPOINT_DENIED/);
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

test('main chat can send only bounded same-origin plain text to the Academy board',()=>{
  assert.match(app,/function sendTextToSinbadAcademyBoard\(text\)/);
  assert.match(app,/slice\(0,200\)/);assert.match(app,/type:'SINBAD_ACADEMY_WRITE_BOARD'/);assert.match(app,/event\.data\.type==='SINBAD_ACADEMY_READY'/);assert.match(app,/sinbadAcademyBoardQueue\.length/);assert.match(app,/requestId=`academy-board-/);assert.match(app,/event\.data\.requestId===entry\.payload\.requestId/);
  assert.match(academyApp,/function writeCustomTextAtBoard\(rawText\)/);
  assert.match(academyApp,/event\.origin!==location\.origin\|\|event\.source!==window\.opener/);
  assert.match(academyApp,/message\.text\.length<=200/);assert.match(academyApp,/writeCustomTextAtBoard\(message\.text\)/);assert.match(academyApp,/type:'SINBAD_ACADEMY_READY'/);assert.match(academyApp,/requestId:message\.requestId/);
  assert.match(app,/function sendShapeToSinbadAcademyBoard\(shape,size='standard'\)/);assert.match(academyApp,/function drawAllowedShapeAtBoard\(shape,size='standard'\)/);
  assert.match(academyApp,/dataset\.boardSize=safeSize/);assert.match(academyApp,/\['small','standard','large'\]/);
  assert.match(academyApp,/\['circle','triangle','rectangle','hexagon','arrow','axes'\]\.includes\(message\.shape\)/);assert.match(academyApp,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
  for(const shape of ['triangle','rectangle','arrow','axes'])assert.match(academyApp,new RegExp(`${shape}:Object\\.freeze`));assert.match(academyApp,/svg\.dataset\.boardShape=shape/);
  assert.match(academyApp,/function animateAllowedShapeDrawing\(generation,shape,reducedMotion=false\)/);
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

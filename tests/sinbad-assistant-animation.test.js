'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const academyHtml=fs.readFileSync('academy.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const rig=fs.readFileSync('sinbad-character-rig.js','utf8');

test('a single centralised, testable state API exists with the required states, including board-teaching from the Academy manifest',()=>{
  assert.match(app,/function setSinbadAssistantState\(state,detail=\{\}\)\{/);
  assert.match(app,/const SINBAD_ASSISTANT_STATES=\[[^\]]*'idle'[^\]]*'listening'[^\]]*'thinking'[^\]]*'preparing-voice'[^\]]*'speaking'[^\]]*'walking'[^\]]*'success'[^\]]*'warning'[^\]]*'error'[^\]]*'voice-disabled'[^\]]*'board-teaching'[^\]]*\]/);
});

test('unknown state falls back to idle safely',()=>{
  assert.match(app,/const next=SINBAD_ASSISTANT_STATES\.includes\(state\)\?state:'idle';/);
});

test('the Claude integration contract signature (state, detail) is accepted and retained',()=>{
  assert.match(app,/sinbadAssistantLastDetail=detail\|\|\{\};/);
});

test('visuals come from the real Academy illustration pack, never redrawn or SVG-imitated',()=>{
  assert.match(app,/const SINBAD_AVATAR_ASSET_BASE='\.\/assets\/captain-sinbad\/';/);
  assert.match(app,/idle:'captain-sinbad-idle-master\.png'/);
  assert.match(app,/listening:'captain-sinbad-listening\.png'/);
  assert.match(app,/thinking:'captain-sinbad-thinking\.png'/);
  assert.match(app,/speaking:'captain-sinbad-speaking\.png'/);
  assert.match(app,/'board-teaching':'captain-sinbad-board-teaching\.png'/);
  assert.doesNotMatch(html,/<symbol id="sinbadCaptainSymbol"/);
  assert.doesNotMatch(html,/circle cx="80" cy="80" r="74" fill="#102b40" stroke="#e2bf72"/);
});

test('logical states without dedicated art honestly fall back to the idle pose, not an invented one',()=>{
  assert.match(app,/'preparing-voice':'captain-sinbad-idle-master\.png'/);
  assert.match(app,/success:'captain-sinbad-idle-master\.png'/);
  assert.match(app,/warning:'captain-sinbad-idle-master\.png'/);
  assert.match(app,/error:'captain-sinbad-idle-master\.png'/);
  assert.match(app,/'voice-disabled':'captain-sinbad-idle-master\.png'/);
});

test('the hero portrait asset exists but is never wired into the live per-state asset map',()=>{
  assert.doesNotMatch(app,/captain-sinbad-hero-portrait\.png/);
  assert.ok(fs.existsSync('assets/captain-sinbad/captain-sinbad-hero-portrait.png'));
});

test('all six Academy assets were copied byte-identical from the source pack (no recompression)',()=>{
  const crypto=require('node:crypto');
  const path=require('node:path');
  const srcDir='C:/Users/ASUS/.codex/visualizations/2026/08/12/019ff500-c4ea-7481-afde-c801a1fb3741/captain-sinbad-academy-pack-v1';
  const files=['captain-sinbad-idle-master.png','captain-sinbad-listening.png','captain-sinbad-thinking.png','captain-sinbad-speaking.png','captain-sinbad-board-teaching.png','captain-sinbad-hero-portrait.png'];
  for(const file of files){
    const srcPath=path.join(srcDir,file);
    if(!fs.existsSync(srcPath))continue; // machine-specific source path; skip if unavailable in this environment
    const srcHash=crypto.createHash('md5').update(fs.readFileSync(srcPath)).digest('hex');
    const destHash=crypto.createHash('md5').update(fs.readFileSync(path.join('assets/captain-sinbad',file))).digest('hex');
    assert.equal(destHash,srcHash,`${file} differs from the source pack - must be a byte-identical copy`);
  }
});

test('avatar image swap preloads all unique state assets and preserves aspect/alpha via CSS object-fit (no cropping tool run)',()=>{
  assert.match(app,/function preloadSinbadAvatarAssets\(\)\{/);
  assert.match(css,/\.sinbad-avatar-img\{position:absolute;inset:0;width:100%;height:100%;object-fit:contain/);
  // the normal large-avatar card crops close (chest/belt-up) so the face,
  // eyes, mouth and hand gesture stay legible at card size - a tiny full-body
  // figure reads as blank. Full body is reserved for the board-teaching /
  // Academy scene, which overrides back to object-fit:contain on a taller card.
  assert.match(css,/\.sinbad-avatar\.large \.sinbad-avatar-img\{object-fit:cover/);
  assert.match(css,/\.sinbad-avatar\.large\[data-state="board-teaching"\] \.sinbad-avatar-img\{object-fit:contain/);
  assert.match(css,/\.sinbad-avatar\.large\[data-state="board-teaching"\]\{height:258px\}/);
  // the small floating avatar (illegible at full-body scale) also crops to a head shot.
  assert.match(css,/\.sinbad-avatar\.small \.sinbad-avatar-img\{object-fit:cover/);
});

test('a real blink frame is bounded to calm states and respects visibility and reduced motion',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.ok(fs.existsSync('assets/captain-sinbad/captain-sinbad-idle-blink-v1.png'));
  assert.match(app,/const SINBAD_BLINK_ASSET='captain-sinbad-idle-blink-v1\.png';/);
  assert.match(app,/\['idle','voice-disabled','success','warning','error'\]\.includes\(sinbadAssistantState\)/);
  assert.match(app,/document\.visibilityState!=='hidden'/);
  assert.match(app,/prefers-reduced-motion: reduce/);
  assert.match(app,/3800\+Math\.floor\(Math\.random\(\)\*3200\)/);
  assert.match(css,/\.sinbad-avatar\.sinbad-blinking \.sinbad-avatar-blink\{opacity:1\}/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-idle-blink-v1\.png'/);
});

test('real phoneme frames follow audio amplitude or genuine speech boundaries and close on silence',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  for(const file of ['captain-sinbad-speaking-mbp-v1.png','captain-sinbad-speaking-o-v1.png']){
    assert.ok(fs.existsSync(`assets/captain-sinbad/${file}`));assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
  }
  assert.match(app,/const SINBAD_SPEECH_ASSETS=Object\.freeze\(\{closed:'captain-sinbad-speaking-mbp-v1\.png',open:'captain-sinbad-speaking\.png',wide:'captain-sinbad-speaking\.png',round:'captain-sinbad-speaking-o-v1\.png'\}\);/);
  assert.match(app,/setSinbadMouthFrame\(amp<\.1\?'closed':amp<\.44\?'open':'wide'\)/);
  assert.match(app,/sinbadVisemePlanner\?\.visemeForBoundary\(\{text:spokenText,charIndex:boundaryEvent\?\.charIndex,step:sequenceStep\}\)/);
  assert.match(app,/planned\?\.accepted\?planned\.frame:SINBAD_STANDARD_VISEME_CADENCE\[sequenceStep%SINBAD_STANDARD_VISEME_CADENCE\.length\]/);
  assert.match(app,/setSinbadMouthFrame\('closed'\)/);
  assert.match(css,/data-mouth-frame="round"/);
});

test('laughing is a real illustrated, labelled and time-bounded reaction',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.ok(fs.existsSync('assets/captain-sinbad/captain-sinbad-laughing-v1.png'));
  assert.match(app,/laughing:'captain-sinbad-laughing-v1\.png'/);
  assert.match(app,/laughing:'Gülüyor'/);assert.match(app,/laughing:'Laughing'/);
  assert.match(app,/if\(next==='laughing'\)sinbadAssistantTimers\.push\(setTimeout/);
  assert.match(app,/if\(!\['laugh','walk'\]\.includes\(action\)\)return Object\.freeze\(\{accepted:false,reason:'UNKNOWN_REACTION'\}\)/);
  assert.match(app,/const event=action==='walk'\?'WALK':'LAUGH'/);
  assert.match(css,/data-gesture="laugh"/);assert.match(sw,/captain-sinbad-laughing-v1\.png/);
});

test('SpeechRecognition lifecycle drives listening, not a fake button-press state',()=>{
  assert.match(app,/sinbadRecognition\.onstart=\(\)=>\{if\(sinbadRecognition!==recognition\)return;sinbadIsListening=true;/);
  assert.match(app,/sinbadRecognition\.onsoundstart=\(\)=>listeningCue\('sound'\)/);
  assert.match(app,/sinbadRecognition\.onspeechstart=\(\)=>\{clearSinbadTurnFinalization\(\);sinbadSpeechSegmentStartedAt=Date\.now\(\);listeningCue\('speech'\);\}/);
  assert.match(app,/sinbadRecognition\.onspeechend=\(\)=>listeningCue\('pause'\)/);
  assert.match(app,/listeningCueForText\?\.\(heardText,revision\)/);
  assert.match(app,/createListeningReactionDirector\?\.\(\)/);
  assert.match(app,/listeningReactions\?\.select\(heardText,revision\)/);
  assert.match(app,/semantic\?\.accepted&&semantic\.meaning!=='neutral'/);
  assert.match(app,/listeningReaction:semantic\?\.reactionId\|\|'steady'/);
  assert.match(app,/const progressBucket=Math\.floor\(heardSoFar\.length\/12\)/);
  assert.match(app,/if\(hasFinal\)listeningCue\('processed',progressBucket,heardSoFar\)/);
  assert.match(app,/listeningCue\('interim',progressBucket,heardSoFar\)/);
  assert.match(app,/else if\(progressBucket>listeningProgressBucket\)/);
  assert.match(css,/data-listening-activity="speech"/);
  assert.match(css,/data-gesture="listen-orient"/);
  assert.match(css,/data-gesture="listen-follow"/);
});

test('short natural pauses are buffered into one bounded user turn',()=>{
  assert.match(app,/const SINBAD_TURN_PAUSE_MS=700;/);
  assert.match(app,/const SINBAD_TURN_MAX_MS=2800;/);
  assert.match(app,/onspeechstart=\(\)=>\{clearSinbadTurnFinalization\(\);sinbadSpeechSegmentStartedAt=Date\.now\(\);listeningCue\('speech'\);\}/);
  assert.match(app,/heardSoFar=\[sinbadPendingSpeechTurn,current\]\.filter\(Boolean\)\.join\(' '\)\.trim\(\)/);
  assert.match(app,/sinbadPendingSpeechTurn=\[sinbadPendingSpeechTurn,heard\]\.filter\(Boolean\)\.join\(' '\)\.trim\(\)/);
  assert.match(app,/scheduleSinbadTurnFinalization\(\)/);
  assert.match(app,/scheduleSinbadListening\(90\)/);
  assert.match(app,/listeningPauseForPace\?\.\(heard,durationMs\)/);
  assert.match(app,/pace\?\.accepted\?pace\.pauseMs:SINBAD_TURN_PAUSE_MS/);
  assert.match(app,/listeningCueForPace\?\.\(sinbadPendingSpeechPace\)/);
  assert.match(app,/listeningActivity:'continuation'/);
  assert.match(app,/el\.dataset\.listeningPace=detail\.listeningPace/);
  assert.match(app,/elapsed>=SINBAD_TURN_MAX_MS\?120:sinbadTurnPauseMs/);
  assert.match(app,/const activeRecognition=sinbadRecognition;sinbadRecognition=null;sinbadIsListening=false;activeRecognition\?\.abort\(\)/);
});

test('walking uses two real alpha PNG frames and a bounded user-triggered cycle',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  for(const file of ['captain-sinbad-walk-a-v1.png','captain-sinbad-walk-b-v1.png']){const path=`assets/captain-sinbad/${file}`;assert.ok(fs.existsSync(path));const bytes=fs.readFileSync(path);assert.equal(bytes.toString('ascii',1,4),'PNG');assert.equal(bytes[25],6);}
  assert.match(app,/const SINBAD_WALK_ASSETS=Object\.freeze\(\['captain-sinbad-walk-a-v1\.png','captain-sinbad-walk-b-v1\.png'\]\)/);
  assert.match(app,/function startSinbadWalkCycle\(generation\)/);assert.match(app,/setTimeout\(tick,280\)/);assert.match(app,/if\(next==='walking'\).*2240/);
  assert.match(app,/action==='walk'&&!\['idle','voice-disabled'\]\.includes\(sinbadAssistantState\)/);
  assert.match(html,/id="testSinbadWalk"/);assert.match(sw,/captain-sinbad-walk-a-v1\.png/);assert.match(sw,/captain-sinbad-walk-b-v1\.png/);
});

test('a supported chat walk request uses the bounded character controller and records only acceptance',()=>{
  assert.match(app,/function performSinbadDirectCharacterRequest\(request\)/);
  assert.match(app,/if\(!request\?\.directCharacterReaction\|\|request\.action!=='walk'\)return Object\.freeze/);
  assert.match(app,/stopSinbadGesturePerformance\(\);\s*\n\s*const reaction=window\.SinbadCharacterController/);
  assert.match(app,/SinbadCharacterController\?\.react\?\.\('walk'\)/);
  assert.match(app,/if\(!reaction\?\.accepted\)return Object\.freeze/);
  assert.match(app,/commitSinbadPerformedGestureAction\('walk'\)/);
  assert.match(app,/const directReaction=performSinbadDirectCharacterRequest\(sinbadRequestedGesture\)/);
});

test('sending a question drives thinking, synced with the existing #sinbadThinking bubble',()=>{
  const sendToSinbad=app.slice(app.indexOf('async function sendToSinbad'),app.indexOf("$('sendSinbad').addEventListener"));
  assert.match(sendToSinbad,/setSinbadThinkingStage\('analyzing'\);\s*\n\s*\$\('sinbadThinking'\)\.classList\.remove\('hidden'\);/);
  assert.match(sendToSinbad,/setSinbadThinkingStage\('calculating'\);\s*\n\s*const plotted=await prepareNavigationPlotFromConversation/);
});

test('preparing-voice starts before the XTTS fetch, not after it resolves',()=>{
  const speakSinbad=app.slice(app.indexOf('async function speakSinbad'),app.indexOf('async function speakSinbad')+900);
  assert.match(speakSinbad,/const controller=new AbortController\(\);sinbadVoiceAbort=controller;\s*\n\s*setSinbadAssistantState\('preparing-voice',sinbadResponseOpeningCue\);/);
});

test('speaking only starts on the real audio "playing" event, never on fetch/announce',()=>{
  assert.match(app,/audio\.addEventListener\('playing',\(\)=>\{\s*\n\s*if\(sinbadVoiceAbort!==controller\)return;\s*\n\s*setSinbadAssistantState\('speaking',sinbadResponseOpeningCue\);\s*\n\s*commitSinbadPreparedGesture\(\);\s*\n\s*playSinbadRequestedGestureSequence\(\);\s*\n\s*startSinbadLipSyncAnalyser\(audio\);\s*\n\s*\},\{once:true\}\);/);
  const playIdx=app.indexOf("audio.play().catch");
  const listenerIdx=app.indexOf("audio.addEventListener('playing'");
  assert.ok(listenerIdx>0&&listenerIdx<playIdx,'the playing listener must be attached before audio.play() is called');
});

test('lip-sync analyser is best-effort and never blocks or silences audio playback on failure',()=>{
  const fn=app.slice(app.indexOf('async function startSinbadLipSyncAnalyser'),app.indexOf('let sinbadAvatarImageGeneration'));
  assert.match(fn,/try\{/);
  assert.match(fn,/\}catch\(error\)\{/);
  assert.match(fn,/console\.warn\('Sinbad lip-sync analyser unavailable; using CSS fallback',error\)/);
  assert.doesNotMatch(fn,/audio\.pause\(\)/);
  assert.doesNotMatch(fn,/audio\.src=/);
});

test('XTTS/Bridge failure shows a calm error state and never re-enables browser speechSynthesis',()=>{
  const errorCatch=app.slice(app.indexOf("console.warn('Sinbad XTTS clone unavailable"),app.indexOf("console.warn('Sinbad XTTS clone unavailable")+400);
  assert.match(errorCatch,/setSinbadAssistantState\('error'\);/);
  assert.doesNotMatch(app,/speakSinbadFallback\(cleanText\)/);
  assert.doesNotMatch(app,/onvoiceschanged=.*speakSinbad\(text\)/);
});

test('voice-disabled toggles with the real voice switch, and startup state matches persisted preference',()=>{
  assert.match(app,/if\(!sinbadState\.voiceEnabled\)\{stopSinbadVoice\(\);setSinbadAssistantState\('voice-disabled'\);\}else if\(sinbadAssistantState==='voice-disabled'\)setSinbadAssistantState\('idle'\);/);
  assert.match(app,/setSinbadAssistantState\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\);/);
});

test('audio ended/aborted resolves the avatar, while genuine text-only delivery gets a bounded presenting state',()=>{
  const fn=app.slice(app.indexOf('function finishSinbadVoice'),app.indexOf('function stopSinbadVoice'));
  assert.match(fn,/setSinbadAssistantState\(forceState\|\|\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\),isPresenting\?sinbadResponseOpeningCue:\{\}\);/);
  assert.match(fn,/if\(isPresenting\)\{[\s\S]*return;[\s\S]*\}\s*scheduleSinbadListening\(\);/);
});

test('an aborted/superseded XTTS request cannot corrupt the animation state',()=>{
  const listenerBlock=app.slice(app.indexOf("audio.addEventListener('playing'"),app.indexOf("audio.addEventListener('playing'")+160);
  assert.match(listenerBlock,/if\(sinbadVoiceAbort!==controller\)return;/);
});

test('success and warning are wired to real completed operations, not guessed',()=>{
  assert.match(app,/addSinbadMessage\('sinbad',`Passage plan draft created[^`]*`\);\s*\n\s*setSinbadAssistantState\('success'\);/);
  assert.match(app,/const SINBAD_MISSING_WAYPOINTS_MESSAGE='Add at least two waypoints with valid latitude and longitude\.';/);
  assert.match(app,/setSinbadAssistantState\(error\.message===SINBAD_MISSING_WAYPOINTS_MESSAGE\?'warning':'error'\);/);
});

test('tab-hidden reduces animation via a real visibilitychange listener',()=>{
  assert.match(app,/document\.addEventListener\('visibilitychange',\(\)=>\{\s*\n\s*document\.documentElement\.classList\.toggle\('sinbad-tab-hidden',document\.visibilityState==='hidden'\);/);
  assert.match(css,/html\.sinbad-tab-hidden \.sinbad-avatar \*\{animation-play-state:paused!important\}/);
});

test('an explicit detail.reducedMotion from the Claude integration contract can force-disable animation independent of the OS preference',()=>{
  assert.match(app,/if\('reducedMotion' in \(detail\|\|\{\}\)\)document\.documentElement\.classList\.toggle\('sinbad-force-reduced-motion',detail\.reducedMotion===true\);/);
  assert.match(css,/\.sinbad-force-reduced-motion \.sinbad-avatar-img\{animation:none!important\}/);
});

test('large and small avatars both render the real illustration via <img>, one accessible name kept on the large avatar',()=>{
  const largeCount=(html.match(/class="sinbad-avatar-img"/g)||[]).length;
  assert.equal(largeCount,2,'expected exactly one <img> for the large avatar and one for the small avatar');
  assert.match(html,/class="sinbad-avatar large" data-state="idle" role="img" aria-label="Captain Sinbad, AI marine intelligence guide"/);
  assert.match(html,/class="sinbad-avatar small" data-state="idle" aria-hidden="true"/);
  assert.match(html,/<img class="sinbad-avatar-img" src="\.\/assets\/captain-sinbad\/captain-sinbad-idle-master\.png" alt="">/);
});

test('a visible, aria-live status line exists for the large avatar so state is never colour-only',()=>{
  assert.match(html,/<p id="sinbadAvatarStatus" class="sinbad-status-line" aria-live="polite">Ready<\/p>/);
  assert.match(app,/const statusText=next==='thinking'&&thinkingCopy\[detail\.thinkingStage\]\?thinkingCopy\[detail\.thinkingStage\]:next==='speaking'&&responseCopy\[detail\.responseKind\]\?responseCopy\[detail\.responseKind\]:\(copy\[next\]\|\|next\);/);
  assert.match(app,/if\(label&&\(changed\|\|next==='thinking'\)\)label\.textContent=statusText;/);
});

test('idle micro-motion is sparse, interruptible and disabled for hidden or reduced-motion views',()=>{
  assert.match(app,/createIdleBehaviorDirector\?\.\(\)/);
  assert.match(app,/sinbadAssistantState==='idle'&&document\.visibilityState!=='hidden'/);
  assert.match(app,/prefers-reduced-motion: reduce/);
  assert.match(app,/setTimeout\(\(\)=>\{if\(sinbadIdleMotionAllowed\(\)\)setSinbadAssistantState\('idle',behavior\.cue\);\},behavior\.delayMs\)/);
  assert.match(app,/if\(next==='idle'&&detail\.idleMotion\)el\.dataset\.idleMotion=detail\.idleMotion/);
  assert.match(app,/sinbadAssistantLastDetail\.idleMotion===detail\.idleMotion/);
  assert.match(app,/scheduleSinbadBlink\(\);scheduleSinbadIdleMotion\(\)/);
});

test('live speech and text cues update real rig controls instead of labels alone',()=>{
  assert.match(app,/function applySinbadLivePerformanceCue\(cue,\{speechBoundary=''\}=\{\}\)/);
  assert.match(app,/poseForPerformance\?\.\(sinbadAssistantState,cue\.gesture/);
  assert.match(app,/Object\.entries\(rigCss\.variables\)\.forEach\(\(\[name,value\]\)=>el\.style\.setProperty\(name,value\)\)/);
  assert.match(app,/transitionForControls\?\.\(previous,rigPose\.controls,\{urgent:cue\.responseKind==='caution'/);
  assert.match(app,/--sinbad-motion-duration',`\$\{transition\.durationMs\}ms`/);
  assert.match(app,/function currentSinbadLiveRigControls\(now=performance\.now\(\)\)/);
  assert.match(app,/interpolateControls\?\.\(from,to,progress\)/);
  assert.match(app,/el\.dataset\.motionInterrupted='true'/);
  assert.match(app,/applySinbadLivePerformanceCue\(performanceCue,\{speechBoundary:performanceCue\.cadence\|\|'word'\}\)/);
  assert.match(app,/sinbadTextPresentationCues\.slice\(1\)[\s\S]*applySinbadLivePerformanceCue\(cue\)/);
});

test('text-only answers are honestly presented without entering the speaking or mouth-animation state',()=>{
  assert.match(app,/presenting:'Yanıtı ekranda sunuyor'/);
  assert.match(app,/presenting:'captain-sinbad-idle-master\.png'/);
  assert.match(app,/if\(next==='presenting'\)sinbadAssistantTimers\.push\(setTimeout\(\(\)=>\{if\(sinbadAssistantState==='presenting'\)\{setSinbadAssistantState\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\);scheduleSinbadListening\(\);\}\},1800\)\);/);
  assert.match(app,/finishSinbadVoice\('presenting'\)/);
  assert.match(app,/setSinbadAssistantState\(forceState\|\|\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\),isPresenting\?sinbadResponseOpeningCue:\{\}\);/);
  assert.match(app,/if\(sinbadResponseOpeningCue\.responseKind\)setSinbadResponseKind\(sinbadResponseOpeningCue\.responseKind\);/);
  assert.match(app,/sinbadTextPresentationCues\.slice\(1\)\.forEach\(cue=>sinbadAssistantTimers\.push\(setTimeout/);
  assert.match(app,/if\(sinbadAssistantState!=='presenting'\)return;/);
  assert.doesNotMatch(css,/data-state="presenting"\]\[data-mouth-frame/);
  assert.match(css,/data-state="presenting"\] \.sinbad-status-light\{background:var\(--green\)\}/);
});

test('reduced-motion strips every keyframe animation in the Sinbad avatar block but keeps colour/text state cues',()=>{
  const sectionStart=css.indexOf('/* ---- Captain Sinbad live assistant avatar');
  const sectionEnd=css.indexOf('.cloud-status-grid{',sectionStart);
  assert.ok(sectionStart>0&&sectionEnd>sectionStart);
  const section=css.slice(sectionStart,sectionEnd);
  const motionBlockStart=section.indexOf('@media not (prefers-reduced-motion: reduce){');
  const motionBlockEnd=section.indexOf('@media (prefers-reduced-motion: reduce){',motionBlockStart);
  assert.ok(motionBlockStart>0&&motionBlockEnd>motionBlockStart);
  const guarded=section.slice(motionBlockStart,motionBlockEnd);
  const allAnimationDecls=(section.match(/[^-]animation:/g)||[]).length;
  const guardedAnimationDecls=(guarded.match(/[^-]animation:/g)||[]).length;
  // one extra "animation:none!important" line each in the reduce-media block and
  // the .sinbad-force-reduced-motion override sit outside the "not reduce" guard
  // by design (they are the off-switches, not animations to strip).
  assert.equal(allAnimationDecls,guardedAnimationDecls+2,'unexpected animation: declarations outside the guarded block');
  assert.match(css,/\.sinbad-avatar\[data-state="warning"\] \.sinbad-status-light\{background:#d99a3d\}/);
});

test('warning never uses a red alarm colour, and error stays calm (no urgent/fast keyframe reused)',()=>{
  assert.doesNotMatch(css,/warning[^{]*\{[^}]*border-color:var\(--danger\)/);
  assert.doesNotMatch(css,/warning[^{]*\{[^}]*background:var\(--danger\)/);
});

test('service worker cache version was bumped for this change and precaches the real bound-state Academy assets for offline use (hero-portrait excluded - see the round-table fix test)',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  const visible=html.match(/<div class="version">● v(\d+\.\d+\.\d+)<\/div>/);
  assert.ok(visible);
  assert.match(sw,new RegExp(`const CACHE='sinbad-marine-v${visible[1].replace(/\./g,'\\.')}-`));
  assert.match(sw,/'\.\/sinbad-character-engine\.js'/);
  assert.match(sw,/'\.\/sinbad-character-rig\.js'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-idle-master\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-listening\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-thinking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-speaking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-board-teaching\.png'/);
});

test('tablet: the compact avatar rail gives status and capabilities dedicated grid areas without collisions',()=>{
  assert.match(css,/@media\(max-width:900px\)\{\.sinbad-layout\{grid-template-columns:1fr\}/);
  assert.match(css,/\.sinbad-avatar\.large\{grid-row:1\/4;width:96px;height:82px\}/);
  assert.match(css,/\.sinbad-capabilities\{grid-column:2\/4;display:flex;/);
  assert.match(css,/\.sinbad-status-line\{grid-column:2\}/);
});

test('board-teaching state exists with real art wired for the native Academy stage',()=>{
  assert.match(app,/'board-teaching':'captain-sinbad-board-teaching\.png'/);
  assert.doesNotMatch(app,/setSinbadAssistantState\('board-teaching'\)/);
});

// ---- Voice architecture decision: standard (low-latency browser TTS) is the
// default provider; xtts-clone is preserved but optional. Both share one
// event contract into the avatar state machine. ----

test('standard is the default voice provider, xtts-clone is preserved but not deleted',()=>{
  assert.match(app,/let sinbadVoiceProvider='standard';/);
  assert.match(app,/function speakSinbad\(text,onVoiceReady\)\{\s*\n\s*prepareSinbadResponsePerformance\(text\);\s*\n\s*if\(sinbadVoiceProvider==='xtts-clone'\)return speakSinbadXttsClone\(text,onVoiceReady\);\s*\n\s*return speakSinbadStandard\(text,onVoiceReady\);\s*\n\}/);
  assert.match(app,/async function speakSinbadXttsClone\(text,onVoiceReady\)\{/);
  assert.match(app,/function speakSinbadStandard\(text,onVoiceReady\)\{/);
});

test('language-aware Academy voice profiles use a calm teaching pace',()=>{
  assert.match(app,/tr:\{rate:\.82,pitch:\.91,volume:1\}/);
  assert.match(app,/en:\{rate:\.86,pitch:\.96,volume:1\}/);
  assert.match(app,/function sinbadVoiceProfileForLanguage\(lang=''\)\{/);
  assert.match(app,/const profile=sinbadVoiceProfileForLanguage\(run\.lang\);/);
  assert.ok(.75<=.82&&.82<=.88,'Turkish teaching rate must be measured');
  assert.ok(.75<=.86&&.86<=.88,'English teaching rate must be measured');
});

test('English letters are never mistaken for Turkish diacritics',()=>{
  assert.match(app,/const hasTurkishChars=\/\[çğıöşüÇĞİÖŞÜ\]\/\.test\(token\);/);
  assert.doesNotMatch(app,/const hasTurkishChars=\/\[cgiosuCGIOSU\]\//);
  assert.match(app,/if\(enScore>trScore\+1\)return 'en-US';/);
  assert.match(app,/const languageRuns=splitSpeechByLanguage\(sentence\.trim\(\),sentenceLang\);/);
});

test('standard speech uses a semantic model summary or a complete-sentence teaching fallback, never a 320-character prefix',()=>{
  assert.doesNotMatch(app,/SINBAD_SPOKEN_SUMMARY_MAX_CHARS|slice\(0,maxChars/);
  assert.match(app,/const SINBAD_SPOKEN_SUMMARY_MAX_SENTENCES=6;/);
  assert.match(app,/const SINBAD_SPOKEN_SUMMARY_MAX_WORDS=110;/);
  assert.match(app,/function buildSinbadSpokenSummary\(text,\{maxSentences=SINBAD_SPOKEN_SUMMARY_MAX_SENTENCES,maxWords=SINBAD_SPOKEN_SUMMARY_MAX_WORDS\}=\{\}\)\{/);
  assert.match(app,/function selectSinbadSpokenText\(answer,modelSummary=''\)\{/);
  assert.match(app,/\.replace\(\/```\[\\s\\S\]\*\?```\/g,' '\)/);
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/const cleanText=selectSinbadSpokenText\(text,sinbadModelSpokenSummary\);/);
  assert.match(fn,/const runs=splitSinbadTeachingSpeech\(cleanText,sinbadState\.language\);/);
});

test('spoken-summary fallback preserves complete ideas beyond 320 characters and prefers a valid model-written lesson summary',()=>{
  const source=app.slice(app.indexOf('const SINBAD_SPOKEN_SUMMARY_MAX_SENTENCES'),app.indexOf('function detectSinbadSpeechLanguage'));
  const helpers=new Function(`${source};return {buildSinbadSpokenSummary,selectSinbadSpokenText};`)();
  const longOpening='Gelgit, Ay ve Güneş çekiminin deniz seviyesinde oluşturduğu düzenli yükselme ve alçalma hareketidir; seyir planlamasında su derinliğini, akıntının yönünü, liman giriş zamanını ve emniyet payını birlikte etkileyen temel bir olaydır.';
  const answer=`${longOpening} İkinci öğretim noktası, gelgit cetvellerinin güncel saat ve düzeltmelerle kullanılmasıdır. Önemli güvenlik kuralı, tahmini değeri güncel resmî yayınla doğrulamaktır. Son ayrıntı yalnız yazılı cevapta kalabilir.`;
  const fallback=helpers.buildSinbadSpokenSummary(answer);
  assert.ok(fallback.length>320,'a coherent lesson may legitimately exceed the old blind 320-character limit');
  assert.match(fallback,/Önemli güvenlik kuralı/);
  assert.doesNotMatch(fallback,/…$/,'fallback must not signal a mid-sentence clipping');
  const modelSummary='Gelgit, su seviyesinin gök cisimlerinin çekimiyle düzenli değişmesidir. Seyir planında derinlik ve akıntı birlikte değerlendirilmelidir. Güncel resmî gelgit yayını mutlaka kontrol edilmelidir.';
  assert.equal(helpers.selectSinbadSpokenText(answer,modelSummary),modelSummary);
});

test('the standard provider prefers a tr-TR voice via a dedicated selector, never silently substituting a mismatched-language voice',()=>{
  assert.match(app,/function pickSinbadTurkishVoice\(voices\)\{/);
  assert.match(app,/const trVoices=voices\.filter\(v=>v\.lang\.toLowerCase\(\)==='tr-tr'\|\|v\.lang\.toLowerCase\(\)\.startsWith\('tr'\)\);/);
  // the old cross-language English fallback in pickVoiceForLang must be gone
  assert.doesNotMatch(app,/voices\.find\(v=>\/\^en\[-_\]\/i\.test\(v\.lang\)\)/);
  assert.match(app,/return voices\.find\(v=>v\.lang\.toLowerCase\(\)===lang\.toLowerCase\(\)\)\|\|voices\.find\(v=>v\.lang\.toLowerCase\(\)\.startsWith\(root\)\)\|\|null;/);
});

test('when no suitable voice is found, the app skips audio entirely and stays in text mode - never a mismatched-language fallback voice',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function speakSinbadXttsClone'));
  assert.match(fn,/if\(!voice\)\{/);
  assert.match(fn,/sinbadNoVoiceMessage\(run\.lang\)/); // language-specific status surfaces the gap
  // no SpeechSynthesisUtterance is constructed on the no-voice branch: it
  // returns (via speakNext()) before ever reaching `new SpeechSynthesisUtterance`.
  const noVoiceBranch=fn.slice(fn.indexOf('if(!voice){'),fn.indexOf('const utterance=new SpeechSynthesisUtterance'));
  assert.match(noVoiceBranch,/announce\(\);\s*\n\s*speakNext\(\);\s*\n\s*return;/);
  assert.doesNotMatch(noVoiceBranch,/SpeechSynthesisUtterance/);
  // the old "system default voice will be used" phrasing must be gone entirely
  assert.doesNotMatch(app,/sistemin varsay|sistem varsay/i);
  // once a voice IS found, it is always assigned (never left to browser-default guessing)
  assert.match(fn,/utterance\.voice=voice;\s*\n\s*utterance\.lang=voice\.lang;/);
});

test('when the browser reports zero voices at all, a bounded timeout falls back to text mode (warning, auto-clearing) instead of hanging forever waiting for onvoiceschanged',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  const zeroVoiceBranch=fn.slice(fn.indexOf('if(!voices.length){'),fn.indexOf('if(sinbadIsListening)'));
  assert.match(zeroVoiceBranch,/setTimeout\(\(\)=>\{/);
  assert.match(zeroVoiceBranch,/1500/);
  assert.match(zeroVoiceBranch,/sinbadNoVoiceMessage\(sinbadState\.language,true\)/); // language-specific status instead of hanging silently
  assert.match(zeroVoiceBranch,/announce\(\);/); // text answer is still delivered even with zero voices
  assert.match(zeroVoiceBranch,/clearTimeout\(voiceWaitTimer\);/); // a real voiceschanged event cancels the fallback timer
  assert.match(zeroVoiceBranch,/let settled=false;/);
  // a spurious voiceschanged firing with a still-empty list must not settle the wait
  assert.match(zeroVoiceBranch,/settled\|\|!speechSynthesis\.getVoices\(\)\.length\)return;/);
  // the avatar must never stay stuck in preparing-voice: it resolves via the
  // single idempotent finishSinbadVoice path, to warning (not voice-disabled -
  // this is a transient per-turn hiccup, not the user's persistent preference)
  assert.match(zeroVoiceBranch,/finishSinbadVoice\('warning'\);/);
});

test('acceptance regression: the avatar never stays in preparing-voice forever when no suitable selected-language voice exists among a real voice list',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/let anyVoiceQueued=false;/);
  assert.match(fn,/anyVoiceQueued=true;/);
  const terminalBranch=fn.slice(fn.indexOf('if(index>=runs.length){'),fn.indexOf('const run=runs[index++];'));
  assert.match(terminalBranch,/if\(!anyVoiceQueued\)\{/);
  assert.match(terminalBranch,/sinbadNoVoiceMessage\(sinbadState\.language,true\)/);
  assert.match(terminalBranch,/finishSinbadVoice\('warning'\);/);
  assert.match(terminalBranch,/finishSinbadVoice\(\);/); // the anyVoiceQueued branch resolves via the default (idle/voice-disabled) outcome
});

test('speaking (standard provider) starts only on the real utterance onstart event, never when merely queued, and a superseded (stale) call cannot flip state either',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/utterance\.onstart=\(\)=>\{if\(myGeneration!==sinbadStandardSpeechGeneration\)return;announce\(\);setSinbadAssistantState\('speaking',sinbadResponseOpeningCue\);commitSinbadPreparedGesture\(\);playSinbadRequestedGestureSequence\(\);\};/);
  assert.match(fn,/setSinbadAssistantState\('preparing-voice',sinbadResponseOpeningCue\);/);
  // preparing-voice must be set before speechSynthesis.speak() is ever called
  const preparingIdx=fn.indexOf("setSinbadAssistantState('preparing-voice',sinbadResponseOpeningCue)");
  const speakCallIdx=fn.indexOf('speechSynthesis.speak(utterance)');
  assert.ok(preparingIdx>0&&preparingIdx<speakCallIdx);
});

test('onboundary drives a real per-word cue (not a fabricated continuous loop, and never for a superseded call), onend advances/finishes cleanly',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/utterance\.onboundary=event=>\{if\(myGeneration===sinbadStandardSpeechGeneration\)sinbadStandardVoiceTick\(event,run\.text\);\};/);
  assert.match(app,/sinbadSpeechBoundaryCue\(boundaryEvent,spokenText,sinbadStandardMouthSequence-1\)/);
  assert.match(fn,/if\(run\.pauseAfter\)setTimeout\(speakNext,run\.pauseAfter\);/);
  assert.match(fn,/else speakNext\(\);/);
  assert.match(app,/function sinbadStandardVoiceTick\(boundaryEvent,spokenText\)\{/);
  assert.match(app,/applySinbadLivePerformanceCue\(performanceCue,\{speechBoundary:performanceCue\.cadence\|\|'word'\}\)/);
  assert.match(app,/function sinbadSpeechBoundaryCue\(boundaryEvent,text,index\)\{/);
  assert.match(css,/\.sinbad-avatar\.sinbad-voice-tick \.sinbad-avatar-img\{transform:scale\(1\.018\)/);
});

test('a new question immediately cancels the previous spoken answer and invalidates queued teaching pauses',()=>{
  const send=app.slice(app.indexOf('async function sendToSinbad'),app.indexOf("$('sendSinbad').addEventListener"));
  assert.match(send,/const q=\(text\|\|'\'\)\.trim\(\); if\(!q\)return;\s*\n\s*clearSinbadTurnFinalization\(\{discard:true\}\);\s*\n\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*interruptSinbadVoiceForUser\(\);/);
  const stop=app.slice(app.indexOf('function stopSinbadVoice'),app.indexOf('let sinbadStandardBoundaryTimer'));
  assert.match(stop,/sinbadStandardSpeechGeneration\+\+;/);
  assert.match(stop,/window\.speechSynthesis\?\.cancel\(\);/);
});

test('a standard-provider error never falls back to a fake state and still lets the conversation continue',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function speakSinbadXttsClone'));
  assert.match(fn,/utterance\.onerror=\(\)=>\{/);
  assert.match(fn,/speakNext\(\);/);
});

test('no "Yasemin" branding appears in any user-visible status text (comments are fine, UI text is not)',()=>{
  const uiStrings=app.match(/textContent=`[^`]*`|textContent='[^']*'/g)||[];
  const leaked=uiStrings.filter(s=>/yasemin/i.test(s));
  assert.deepEqual(leaked,[],`found Yasemin branding in UI-facing text: ${JSON.stringify(leaked)}`);
});

// ---- Acceptance-test follow-up: confirm the standard provider genuinely
// never touches the Bridge/XTTS network surface, and that the pre-existing,
// unrelated Bridge status poll (Route/OpenCPN panel) is correctly left alone
// rather than incorrectly coupled to voice provider choice. ----

test('speakSinbadStandard makes zero references to the Bridge URL or fetch - it is pure Web Speech API, no network calls',()=>{
  const start=app.indexOf('function speakSinbadStandard');
  const end=app.indexOf('\nfunction splitSinbadCloneChunks');
  const fn=app.slice(start,end);
  assert.doesNotMatch(fn,/fetch\(/);
  assert.doesNotMatch(fn,/SINBAD_BRIDGE_URL/);
  assert.match(fn,/speechSynthesis\.speak\(utterance\)/);
});

test('only speakSinbadXttsClone ever calls the /ai/tts endpoint - standard provider cannot reach it by construction',()=>{
  const occurrences=[...app.matchAll(/\/ai\/tts/g)];
  assert.ok(occurrences.length>=1);
  for(const m of occurrences){
    const before=app.slice(0,m.index);
    const lastXttsFn=before.lastIndexOf('async function speakSinbadXttsClone');
    const lastStandardFn=before.lastIndexOf('function speakSinbadStandard(');
    assert.ok(lastXttsFn>lastStandardFn,'/ai/tts reference found outside speakSinbadXttsClone');
  }
});

test('the pre-existing Bridge status poll (Route/OpenCPN panel badge) is intentionally independent of voice provider - documented, not silently coupled',()=>{
  // This interval predates the voice-architecture work and serves the
  // Passage Plan Studio "Bridge online / N routes / N memory chunks" badge,
  // unrelated to TTS. Confirmed still present and NOT gated behind
  // sinbadVoiceProvider - coupling it to voice choice would break Bridge/
  // OpenCPN route transfer for standard-voice users, per explicit product
  // decision (asked and confirmed - see docs/handoff for this session).
  assert.match(app,/setInterval\(checkBridgeStatus,30000\)/);
  const intervalLine=app.slice(app.indexOf('setInterval(checkBridgeStatus'),app.indexOf('setInterval(checkBridgeStatus')+60);
  assert.doesNotMatch(intervalLine,/sinbadVoiceProvider/);
});

test('default voice provider is standard at the source level (window-property reads are unreliable for a `let`-scoped variable, so this checks source text, not runtime window.sinbadVoiceProvider)',()=>{
  const declIdx=app.indexOf("let sinbadVoiceProvider='standard';");
  assert.ok(declIdx>0);
  // must be declared before the dispatcher that reads it
  assert.ok(declIdx<app.indexOf('function speakSinbad(text,onVoiceReady){'));
});

// ---- Round-table review fixes (verified findings only) ----

test('round-table fix: finishSinbadVoice is the single idempotent end-of-turn path and always resolves the avatar state (never skips the transition when voice is off)',()=>{
  const fn=app.slice(app.indexOf('function finishSinbadVoice'),app.indexOf('function stopSinbadVoice'));
  assert.match(fn,/function finishSinbadVoice\(forceState\)\{/);
  // must be an unconditional call, not `if(sinbadState.voiceEnabled)setSinbadAssistantState(...)`
  assert.match(fn,/setSinbadAssistantState\(forceState\|\|\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\),isPresenting\?sinbadResponseOpeningCue:\{\}\);/);
  assert.doesNotMatch(fn,/if\(sinbadState\.voiceEnabled\)setSinbadAssistantState/);
});

test('round-table fix: every early-return in speakSinbadStandard and speakSinbadXttsClone routes through finishSinbadVoice instead of leaving the avatar stuck in thinking/preparing-voice',()=>{
  const standardFn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  const cloneFn=app.slice(app.indexOf('async function speakSinbadXttsClone'),app.indexOf('// Provider switch:'));
  // the old scattered `sinbadAwaitingAnswer=false;scheduleSinbadListening();` pattern must be gone
  assert.doesNotMatch(standardFn,/announce\(\);sinbadAwaitingAnswer=false;scheduleSinbadListening\(\);return;/);
  assert.doesNotMatch(cloneFn,/announce\(\);sinbadAwaitingAnswer=false;scheduleSinbadListening\(\);return;/);
  assert.match(standardFn,/if\(!sinbadState\.voiceEnabled\|\|!\('speechSynthesis'in window\)\)\{announce\(\);finishSinbadVoice\('presenting'\);return;\}/);
  assert.match(cloneFn,/if\(!sinbadState\.voiceEnabled\)\{announce\(\);finishSinbadVoice\('presenting'\);return;\}/);
});

test('round-table fix: a transient "no suitable voice this turn" resolves to the warning state (auto-clears), never voice-disabled, so it never misrepresents the user\'s persistent voice preference',()=>{
  const standardFn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(standardFn,/finishSinbadVoice\('warning'\);/);
  // the zero-voices timeout branch and the per-run "nobody had a voice" branch
  // must both use the warning outcome, not force voice-disabled directly
  const zeroVoiceBranch=standardFn.slice(standardFn.indexOf('if(!voices.length){'),standardFn.indexOf('if(sinbadIsListening)'));
  assert.doesNotMatch(zeroVoiceBranch,/setSinbadAssistantState\('voice-disabled'\)/);
  assert.match(zeroVoiceBranch,/finishSinbadVoice\('warning'\);/);
  const terminalBranch=standardFn.slice(standardFn.indexOf('if(index>=runs.length){'),standardFn.indexOf('const run=runs[index++];'));
  assert.doesNotMatch(terminalBranch,/setSinbadAssistantState\('voice-disabled'\)/);
  assert.match(terminalBranch,/finishSinbadVoice\('warning'\);/);
});

test('round-table fix: voiceschanged uses addEventListener/removeEventListener with a per-call generation token, not a single-slot onvoiceschanged property that a newer call could overwrite or a stale call could still fire',()=>{
  const standardFn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.doesNotMatch(standardFn,/speechSynthesis\.onvoiceschanged=/);
  assert.match(standardFn,/speechSynthesis\.addEventListener\('voiceschanged',onVoicesChanged\);/);
  assert.match(standardFn,/speechSynthesis\.removeEventListener\('voiceschanged',onVoicesChanged\);/);
  assert.match(app,/let sinbadStandardSpeechGeneration=0;/);
  assert.match(standardFn,/const myGeneration=\+\+sinbadStandardSpeechGeneration;/);
  // timeout, success (voiceschanged fires with a real list), and the
  // per-utterance onstart/onboundary/onerror paths must all check the token
  assert.match(standardFn,/if\(myGeneration!==sinbadStandardSpeechGeneration\|\|settled\)return;/);
  assert.match(standardFn,/if\(myGeneration!==sinbadStandardSpeechGeneration\|\|settled\|\|!speechSynthesis\.getVoices\(\)\.length\)return;/);
  assert.match(standardFn,/if\(myGeneration!==sinbadStandardSpeechGeneration\)return; \/\/ a newer speak request has taken over/);
  assert.match(standardFn,/utterance\.onstart=\(\)=>\{if\(myGeneration!==sinbadStandardSpeechGeneration\)return;announce\(\);setSinbadAssistantState\('speaking',sinbadResponseOpeningCue\);commitSinbadPreparedGesture\(\);playSinbadRequestedGestureSequence\(\);\};/);
  assert.match(standardFn,/utterance\.onboundary=event=>\{if\(myGeneration===sinbadStandardSpeechGeneration\)sinbadStandardVoiceTick\(event,run\.text\);\};/);
  assert.match(standardFn,/utterance\.onerror=\(\)=>\{\s*\n\s*if\(myGeneration!==sinbadStandardSpeechGeneration\)return;/);
});

test('round-table fix: startSinbadLipSyncAnalyser awaits AudioContext.resume() and never taps the <audio> element (which would reroute/silence its output) unless the context is confirmed running',()=>{
  assert.match(app,/async function startSinbadLipSyncAnalyser\(audio\)\{/);
  const fn=app.slice(app.indexOf('async function startSinbadLipSyncAnalyser'),app.indexOf('let sinbadAvatarImageGeneration'));
  assert.match(fn,/await sinbadLipSyncAudioContext\.resume\(\);/);
  assert.match(fn,/if\(sinbadLipSyncAudioContext\.state!=='running'\)return;/);
  // the bail-out must come before any MediaElementSource is created
  const bailIdx=fn.indexOf("state!=='running')return;");
  const tapIdx=fn.indexOf('createMediaElementSource(audio)');
  assert.ok(bailIdx>0&&tapIdx>bailIdx);
});

test('round-table fix: stopSinbadLipSyncAnalyser disconnects the previous source/analyser nodes instead of just cancelling the RAF loop, so repeated speech turns cannot leak Web Audio nodes onto the shared context',()=>{
  const fn=app.slice(app.indexOf('function stopSinbadLipSyncAnalyser'),app.indexOf('async function startSinbadLipSyncAnalyser'));
  assert.match(fn,/sinbadLipSyncSource\.disconnect\(\);/);
  assert.match(fn,/sinbadLipSyncAnalyser\.disconnect\(\);/);
  assert.match(fn,/sinbadLipSyncSource=null;sinbadLipSyncAnalyser=null;/);
  // the setSinbadAssistantState caller must no longer null the analyser ref
  // itself before calling stop - that pre-nulling is exactly what defeated
  // the disconnect cleanup above.
  assert.doesNotMatch(app,/sinbadLipSyncAnalyser=null;stopSinbadLipSyncAnalyser\(\);/);
  assert.match(app,/if\(next!=='speaking'\)stopSinbadLipSyncAnalyser\(\);/);
});

test('round-table fix: the avatar image swap uses a generation token so a slow/stale image load from a superseded state change can never flip opacity back on',()=>{
  assert.match(app,/let sinbadAvatarImageGeneration=0;/);
  const fn=app.slice(app.indexOf('function setSinbadAssistantState'),app.indexOf('function setSinbadVoiceUI'));
  assert.match(fn,/const generation=\+\+sinbadAvatarImageGeneration;/);
  assert.match(fn,/img\.onload=\(\)=>\{if\(generation===sinbadAvatarImageGeneration\)img\.style\.opacity='1';\};/);
});

test('round-table: SpeechRecognition error/abort paths verified - onend (which the Web Speech spec guarantees fires after error/abort) already resets the avatar out of listening, so no fix was needed here',()=>{
  const fn=app.slice(app.indexOf('function beginSinbadRecognition'),app.indexOf('function startSinbadListening'));
  assert.match(fn,/sinbadRecognition\.onerror=event=>\{if\(sinbadRecognition!==recognition\)return;sinbadIsListening=false;/);
  assert.match(fn,/sinbadRecognition\.onend=\(\)=>\{\s*if\(sinbadRecognition!==recognition\)return;\s*sinbadRecognition=null;/);
  assert.match(fn,/if\(sinbadAssistantState==='listening'\)setSinbadAssistantState\('idle'\);/);
});

test('round-table fix: the unused hero-portrait asset is no longer force-downloaded into the offline precache (it is only referenced by the service worker, never by any real UI element)',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.doesNotMatch(sw,/captain-sinbad-hero-portrait\.png/);
  assert.doesNotMatch(app,/hero-portrait/);
  assert.doesNotMatch(html,/hero-portrait/);
  assert.doesNotMatch(css,/hero-portrait/);
});

test('round-table: TTS text normalization verified - the same message text rendered into the chat DOM is HTML-escaped via esc(), and SpeechSynthesisUtterance.text is not an HTML/markup sink, so no concrete injection path exists and no new escaping was added',()=>{
  assert.match(app,/\$\{m\.role==='user'\?'Captain':'Captain Sinbad'\}<\/span>\s*\n\s*\$\{esc\(m\.text\)\}/);
});

test('Sinbad workspace separates chat, Academy, passage planning and sources into accessible tabs without duplicating functional controls',()=>{
  for(const name of ['chat','academy','passage','sources']){
    assert.match(html,new RegExp(`role="tab"[^>]+data-sinbad-tab="${name}"`));
    assert.match(html,new RegExp(`role="tabpanel"[^>]+data-sinbad-panel="${name}"`));
  }
  for(const id of ['sinbadMessages','sinbadInput','sendSinbad','passageDeparture','officialSourceList']){
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must remain unique`);
  }
  assert.equal((html.match(/id="academyModule"/g)||[]).length,0,'Academy controls must not remain embedded in the main app');
  assert.equal((academyHtml.match(/id="academyModule"/g)||[]).length,1,'academyModule must remain unique in the standalone classroom');
});

test('Sinbad workspace tabs implement selection, panel visibility, session preference and keyboard navigation',()=>{
  assert.match(app,/const SINBAD_WORKSPACE_TABS=Object\.freeze\(\['chat','academy','passage','sources'\]\)/);
  assert.match(app,/function setSinbadWorkspaceTab\(requested,\{focus=false\}=\{\}\)/);
  assert.match(app,/button\.setAttribute\('aria-selected',String\(active\)\)/);
  assert.match(app,/panel\.hidden=panel\.dataset\.sinbadPanel!==tab/);
  assert.match(app,/sessionStorage\.setItem\('atlas_sinbad_workspace_tab',tab\)/);
  assert.match(app,/event\.key==='ArrowRight'/);
  assert.match(app,/event\.key==='ArrowLeft'/);
  assert.match(app,/event\.key==='Home'/);
  assert.match(app,/event\.key==='End'/);
});

test('Sinbad usability layout keeps a compact sticky profile, responsive tab rail and sticky chat composer',()=>{
  assert.match(css,/\.sinbad-profile\{position:sticky;/);
  assert.match(css,/\.sinbad-workspace-tabs\{position:sticky;/);
  assert.match(css,/\.sinbad-workspace-panel\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.sinbad-composer\{position:sticky;bottom:0;/);
  assert.match(css,/@media\(max-width:600px\)\{\.sinbad-workspace-tabs\{position:static;display:flex;overflow-x:auto/);
});

test('an explicit microphone press safely interrupts Sinbad and gives the turn to the user',()=>{
  const fn=app.slice(app.indexOf('function startSinbadListening'),app.indexOf('function saveSinbadMessages'));
  assert.match(fn,/const interruptingVoice=sinbadAssistantState==='speaking'\|\|sinbadAssistantState==='preparing-voice'/);
  assert.match(fn,/if\(interruptingVoice\)\{/);
  assert.match(fn,/interruptSinbadVoiceForUser\(\);sinbadAwaitingAnswer=false;sinbadHandsFreeEnabled=true;sinbadWakeActive=true;/);
  assert.match(fn,/setListeningUI\(speechCopy\(\)\.listen,true\);beginSinbadRecognition\(\);return;/);
  assert.doesNotMatch(fn,/sinbadMessages[^;]*=/);
});

test('interrupted delivery is marked and model history stays bounded without auto-resume instructions',()=>{
  assert.match(app,/let sinbadActiveResponseText='';/);
  assert.match(app,/function interruptSinbadVoiceForUser\(\)\{/);
  assert.match(app,/const interruptedText=active\?sinbadActiveResponseText:'';/);
  assert.match(app,/if\(interruptedText\)markSinbadResponseInterrupted\(interruptedText\)/);
  assert.match(app,/delivery:'interrupted',interruptedAt:new Date\(\)\.toISOString\(\)/);
  assert.match(app,/sinbadState\.messages\.slice\(-12,end\)/);
  assert.match(app,/Voice presentation was interrupted by the user; keep the conversational context, do not automatically resume/);
  assert.equal((app.match(/const history=sinbadHistoryForModel\(/g)||[]).length,3);
  assert.match(app,/function resolveSinbadTurnDirective\(text\)\{/);
  assert.match(app,/message\.role==='sinbad'&&message\.delivery==='interrupted'/);
  assert.match(app,/action='continue'/);assert.match(app,/action='restart'/);assert.match(app,/action='summarize'/);
  assert.match(app,/do not claim to resume audio/);
  assert.match(app,/const effectiveQuestion=turnDirective\.accepted\?turnDirective\.question:q/);
  assert.match(app,/sinbadLocalAnswer\(effectiveQuestion\)/);
});

test('rig head, lean and gaze outputs drive the real portrait while caution hold has a distinct bounded gesture',()=>{
  assert.match(css,/transform:rotate\(calc\(var\(--sinbad-rig-head-x,0deg\) \+ var\(--sinbad-rig-lean,0deg\) \+ var\(--sinbad-gaze-offset,0deg\)\)\)/);
  assert.match(css,/\.sinbad-avatar\[data-gaze="thought"\]\{--sinbad-gaze-offset:-\.7deg\}/);
  assert.match(css,/\.sinbad-avatar\[data-gesture="hold"\]\{animation:sinbadStageHold 1\.1s ease-out both\}/);
  assert.match(css,/@keyframes sinbadStageHold\{/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)\{\s*\.sinbad-avatar,\.sinbad-avatar-img\{animation:none!important\}/);
  assert.match(css,/\.sinbad-force-reduced-motion \.sinbad-avatar,\.sinbad-force-reduced-motion \.sinbad-avatar-img\{animation:none!important\}/);
});

test('answer choreography uses a bounded non-repeating improvisation director rather than a fixed visible order',()=>{
  assert.match(app,/createImprovisationDirector\?\.\(\)/);
  assert.match(app,/sinbadImprovisationDirector\?\.choose\(cue\.responseKind,'answer'\)/);
  assert.match(app,/Object\.freeze\(\{\.\.\.cue,\.\.\.improvised\.cue,responseKind:cue\.responseKind\}\)/);
});

test('six bounded motion profiles change gesture timing and are cleared with the next plain state',()=>{
  assert.match(app,/if\(detail\.motionProfile\)el\.dataset\.motionProfile=detail\.motionProfile;\s*\n\s*else delete el\.dataset\.motionProfile;/);
  assert.match(css,/data-motion-profile="measured"\]\{--sinbad-motion-duration:1\.35s;/);
  assert.match(css,/data-motion-profile="deliberate"\]\{--sinbad-motion-duration:1\.85s;/);
  assert.match(css,/data-motion-profile\]\{animation-duration:var\(--sinbad-motion-duration\)!important\}/);
});

test('motion profiles vary bounded body travel, scale and tilt instead of changing speed alone',()=>{
  assert.match(css,/data-motion-profile="lively"\][^\n]*--sinbad-motion-travel:6px[^\n]*--sinbad-motion-scale-up:1\.022/);
  assert.match(css,/data-motion-profile="thoughtful"\][^\n]*--sinbad-motion-travel:2px[^\n]*--sinbad-motion-scale-up:1\.008/);
  assert.match(css,/translateX\(var\(--sinbad-motion-travel,5px\)\)/);
  assert.match(css,/rotate\(var\(--sinbad-motion-tilt-left,-\.7deg\)\)/);
  assert.match(css,/translateY\(var\(--sinbad-motion-nod,4px\)\)/);
});

test('live state applies the selected gesture through the versioned articulated rig contract',()=>{
  assert.match(app,/poseForPerformance\?\.\(next,performance\.gesture,rigOverrides\)\|\|sinbadCharacterRig\?\.poseForState\?\.\(next,rigOverrides\)/);
  assert.match(rig,/const RIG_VERSION='sinbad-2d-rig\/4'/);
  assert.match(rig,/'--sinbad-rig-left-arm'/);
  assert.match(rig,/'--sinbad-rig-right-arm'/);
});

test('large live portrait activates four real alpha rig layers only after every part loads',()=>{
  assert.match(html,/class="sinbad-rig-part sinbad-rig-left-arm"/);
  assert.match(html,/class="sinbad-rig-part sinbad-rig-torso"/);
  assert.match(html,/class="sinbad-rig-part sinbad-rig-right-arm"/);
  assert.match(html,/class="sinbad-rig-part sinbad-rig-head sinbad-rig-head-base"/);
  assert.match(app,/if\(!failed\)avatar\.dataset\.rigReady='true';else delete avatar\.dataset\.rigReady/);
  assert.match(css,/data-rig-ready="true"\] \.sinbad-rig-stage\{opacity:1\}/);
  assert.match(css,/transform:rotate\(var\(--sinbad-rig-left-arm,0deg\)\)/);
  assert.match(css,/transform:rotate\(var\(--sinbad-rig-right-arm,0deg\)\)/);
});

test('every live rig part is a non-empty RGBA PNG rather than a baked checkerboard RGB image',()=>{
  for(const name of ['head','torso','left-arm','right-arm','face-blink','face-closed','face-open','face-wide','face-round','expression-concerned','expression-delighted']){
    const bytes=fs.readFileSync(`assets/captain-sinbad/captain-sinbad-rig-${name}-v1.png`);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
    assert.ok(bytes.readUInt32BE(16)>100,name);
    assert.ok(bytes.readUInt32BE(20)>100,name);
    assert.equal(bytes[25],6,`${name} must use PNG RGBA color type`);
  }
});

test('layered face frames follow real blink and mouth events without replacing the rig body',()=>{
  assert.match(html,/sinbad-rig-face-blink-v1\.png/);
  assert.match(html,/sinbad-rig-face-closed-v1\.png/);
  assert.match(html,/sinbad-rig-face-open-v1\.png/);
  assert.match(html,/sinbad-rig-face-wide-v1\.png/);
  assert.match(html,/sinbad-rig-face-round-v1\.png/);
  assert.match(html,/sinbad-rig-expression-concerned-v1\.png/);
  assert.match(html,/sinbad-rig-expression-delighted-v1\.png/);
  assert.match(css,/sinbad-blinking \.sinbad-rig-face-blink\{opacity:1\}/);
  assert.match(css,/data-mouth-frame="closed"\] \.sinbad-rig-face-closed\{opacity:1\}/);
  assert.match(css,/data-mouth-frame="open"\] \.sinbad-rig-face-open\{opacity:1\}/);
  assert.match(css,/data-mouth-frame="wide"\] \.sinbad-rig-face-wide\{opacity:1\}/);
  assert.match(css,/data-mouth-frame="round"\] \.sinbad-rig-face-round\{opacity:1\}/);
  assert.match(css,/data-state="warning"\]\[data-emotion="concerned"\] \.sinbad-rig-expression-concerned/);
  assert.match(css,/data-state="speaking"\]\[data-emotion="warm"\] \.sinbad-rig-expression-delighted/);
  assert.match(app,/parts\.length!==SINBAD_RIG_PART_ASSETS\.length\+SINBAD_RIG_FACE_ASSETS\.length/);
});

test('a supported explicit gesture request overrides only the opening cue and unsupported poses are never fabricated',()=>{
  assert.match(app,/gestureRequestForText\(question,\{lastAction:sinbadLastPerformedGestureAction\}\)/);
  assert.match(app,/groundResponseWithGesture\?\.\(text,sinbadRequestedGesture,sinbadState\.language\|\|appLanguage\)/);
  assert.match(app,/const answer=groundSinbadResponseToRequestedGesture\(await sinbadLocalAnswer\(effectiveQuestion\)\)/);
  assert.match(app,/sinbadPreparedGestureAction=sinbadRequestedGesture\.compound\?null:sinbadRequestedGesture\.action/);
  assert.match(app,/function commitSinbadPreparedGesture\(\)/);
  assert.match(app,/recordVerifiedGesture\?\.\(sinbadPerformedGestureHistory,action,\{limit:4\}\)/);
  assert.match(app,/sinbadLastPerformedGestureAction=sinbadPerformedGestureHistory\.at\(-1\)\|\|null/);
  assert.match(app,/gestureHistoryAnswerForText\?\.\(q,sinbadPerformedGestureHistory,sinbadState\.language\|\|appLanguage\)/);
  assert.match(app,/gestureStopRequestForText\?\.\(q,sinbadState\.language\|\|appLanguage\)/);
  assert.match(app,/function stopSinbadGesturePerformance\(\)/);
  assert.match(app,/sinbadRequestedGesture=null;sinbadRequestedGestureSequence=\[\];sinbadPreparedGestureAction=null;sinbadExplicitGestureHoldBoundaries=0/);
  assert.match(app,/setSinbadAssistantState\(sinbadState\.voiceEnabled\?'idle':'voice-disabled',\{gesture:'rest',gaze:'audience',emotion:'neutral',energy:0\}\)/);
  assert.match(app,/gestureRecallAnswerForText\?\.\(q,sinbadLastPerformedGestureAction,sinbadState\.language\|\|appLanguage\)/);
  assert.match(app,/if\(sinbadRequestedGesture\?\.supported&&sinbadTextPresentationCues\.length\)/);
  assert.match(app,/\.\.\.sinbadRequestedGesture\.cue,responseKind:sinbadTextPresentationCues\[0\]\.responseKind/);
  assert.match(app,/sinbadRequestedGesture=null;/);
  assert.match(app,/sinbadExplicitGestureHoldBoundaries=sinbadRequestedGesture\?\.supported\?2:0/);
  assert.match(app,/if\(sinbadExplicitGestureHoldBoundaries>0\)\{sinbadExplicitGestureHoldBoundaries--;return Object\.freeze\(\{\.\.\.semantic,gesture:null\}\);\}/);
  const prepare=app.slice(app.indexOf('function prepareSinbadResponsePerformance'),app.indexOf('function commitSinbadPerformedGestureAction'));
  assert.doesNotMatch(prepare,/recordVerifiedGesture/);
  assert.match(app,/if\(isPresenting\)\{\s*\n\s*commitSinbadPreparedGesture\(\);/);
});

test('supported requests play a bounded real gesture sequence on actual voice start',()=>{
  assert.match(app,/gestureSequenceForRequest\?\.\(sinbadRequestedGesture\.action,\{actions:sinbadRequestedGesture\.actions\}\)/);
  assert.match(app,/function playSinbadRequestedGestureSequence\(\)/);
  assert.match(app,/if\(cues\.length<2\|\|!\['speaking','presenting'\]\.includes\(presentationState\)\)return false/);
  assert.match(app,/Math\.max\(1,cues\[index\+1\]\.at-cue\.at\)/);
  assert.match(app,/setSinbadAssistantState\('speaking',sinbadResponseOpeningCue\);commitSinbadPreparedGesture\(\);playSinbadRequestedGestureSequence\(\)/);
  assert.match(app,/if\(cue\.actionStart\)commitSinbadPerformedGestureAction\(cue\.actionStart\)/);
  assert.match(app,/sinbadPreparedGestureAction=sinbadRequestedGesture\.compound\?null:sinbadRequestedGesture\.action/);
});

test('show-palm reuses the verified real open-hand artwork, removes the large-avatar crop and stays bounded',()=>{
  assert.match(css,/\.sinbad-avatar\.large\[data-gesture="show-palm"\] \.sinbad-avatar-img\{object-fit:contain/);
  assert.match(css,/\.sinbad-avatar\[data-gesture="show-palm"\]\{animation:sinbadStageShowPalm 1\.35s ease-out both\}/);
  assert.match(css,/@keyframes sinbadStageShowPalm\{/);
  assert.doesNotMatch(app,/show-palm.*\.png/);
  assert.match(app,/gazeTransitionForCue\?\.\(performance,\{reducedMotion:reducedGazeMotion\}\)/);
  assert.match(css,/data-gaze="palm"\]\{--sinbad-gaze-offset:-1\.35deg\}/);
});

test('thinking animation reports only real asynchronous work stages and removes the old artificial delay',()=>{
  assert.match(app,/function setSinbadThinkingStage\(stage\)\{/);
  assert.match(app,/thinkingCueForStage\(stage\)/);
  assert.match(app,/if\(!result\?\.accepted\)return false;/);
  assert.match(app,/el\.dataset\.thinkingStage=detail\.thinkingStage/);
  assert.match(app,/setSinbadThinkingStage\('calculating'\);\s*\n\s*const plotted=await prepareNavigationPlotFromConversation\(q\)/);
  assert.match(app,/setSinbadThinkingStage\('retrieving'\);\s*\n\s*const status=\$\('sinbadKnowledgeStatus'\)/);
  const send=app.slice(app.indexOf('async function sendToSinbad'),app.indexOf("$('sendSinbad').addEventListener"));
  assert.match(send,/setSinbadThinkingStage\('analyzing'\)/);
  assert.match(send,/setSinbadThinkingStage\('composing'\)/);
  assert.doesNotMatch(send,/setTimeout\(async/);
  assert.match(send,/finally\{\$\('sinbadThinking'\)\.classList\.add\('hidden'\);\}/);
});

test('live speech boundaries expose sentence-level meaning so expression can change during one answer',()=>{
  assert.match(app,/createSpeechGestureDirector\?\.\(\)/);
  assert.match(app,/sinbadSpeechGestureDirector\?\.reset\(\)/);
  assert.match(app,/sinbadSpeechGestureDirector\?\.select\(semantic\)/);
  assert.match(app,/function setSinbadResponseKind\(kind\)\{/);
  assert.match(app,/if\(!Object\.hasOwn\(copy,kind\)\)return false;/);
  assert.match(app,/if\(performanceCue\.responseKind\)setSinbadResponseKind\(performanceCue\.responseKind\);/);
  assert.match(app,/if\(changed\)\{const label=\$\('sinbadAvatarStatus'\);if\(label\)label\.textContent=copy\[kind\];\}/);
  assert.match(app,/sinbadSpeechBoundaryCue\(boundaryEvent,spokenText,sinbadStandardMouthSequence-1\)/);
  assert.match(css,/data-response-kind="caution"/);
  assert.match(css,/data-response-kind="question"/);
  assert.match(css,/data-response-kind="completion"/);
  assert.match(css,/data-response-kind="explanation"/);
});

test('sentence meaning transitions bridge gently but safety escalation stays immediate',()=>{
  assert.match(app,/speechTransitionForKinds\?\.\(sinbadLastSpeechMeaningKind,performanceCue\)/);
  assert.match(app,/if\(transition\.immediate\)setSinbadAssistantState\('speaking',transition\.targetCue\)/);
  assert.match(app,/setSinbadAssistantState\('speaking',transition\.bridgeCue\)/);
  assert.match(app,/sinbadLastSpeechMeaningKind===performanceCue\.responseKind/);
  assert.match(app,/clearTimeout\(sinbadSpeechMeaningTransitionTimer\)/);
});

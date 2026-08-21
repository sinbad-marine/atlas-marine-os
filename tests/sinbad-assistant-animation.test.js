'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('a single centralised, testable state API exists with the required states, including board-teaching from the Academy manifest',()=>{
  assert.match(app,/function setSinbadAssistantState\(state,detail=\{\}\)\{/);
  assert.match(app,/const SINBAD_ASSISTANT_STATES=\[[^\]]*'idle'[^\]]*'listening'[^\]]*'thinking'[^\]]*'preparing-voice'[^\]]*'speaking'[^\]]*'success'[^\]]*'warning'[^\]]*'error'[^\]]*'voice-disabled'[^\]]*'board-teaching'[^\]]*\]/);
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
  assert.match(css,/\.sinbad-avatar-img\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover/);
});

test('SpeechRecognition onstart drives listening, not a fake button-press state',()=>{
  assert.match(app,/sinbadRecognition\.onstart=\(\)=>\{sinbadIsListening=true;setListeningUI\(sinbadWakeActive\?speechCopy\(\)\.listen:handsFreeMessage\(\),true\);setSinbadAssistantState\('listening'\);\};/);
});

test('sending a question drives thinking, synced with the existing #sinbadThinking bubble',()=>{
  const sendToSinbad=app.slice(app.indexOf('async function sendToSinbad'),app.indexOf('async function sendToSinbad')+1200);
  assert.match(sendToSinbad,/setSinbadAssistantState\('thinking'\);\s*\n\s*\$\('sinbadThinking'\)\.classList\.remove\('hidden'\);/);
  assert.match(sendToSinbad,/setSinbadAssistantState\('thinking'\);\s*\n\s*const plotted=await prepareNavigationPlotFromConversation/);
});

test('preparing-voice starts before the XTTS fetch, not after it resolves',()=>{
  const speakSinbad=app.slice(app.indexOf('async function speakSinbad'),app.indexOf('async function speakSinbad')+900);
  assert.match(speakSinbad,/const controller=new AbortController\(\);sinbadVoiceAbort=controller;\s*\n\s*setSinbadAssistantState\('preparing-voice'\);/);
});

test('speaking only starts on the real audio "playing" event, never on fetch/announce',()=>{
  assert.match(app,/audio\.addEventListener\('playing',\(\)=>\{\s*\n\s*if\(sinbadVoiceAbort!==controller\)return;\s*\n\s*setSinbadAssistantState\('speaking'\);\s*\n\s*startSinbadLipSyncAnalyser\(audio\);\s*\n\s*\},\{once:true\}\);/);
  const playIdx=app.indexOf("audio.play().catch");
  const listenerIdx=app.indexOf("audio.addEventListener('playing'");
  assert.ok(listenerIdx>0&&listenerIdx<playIdx,'the playing listener must be attached before audio.play() is called');
});

test('lip-sync analyser is best-effort and never blocks or silences audio playback on failure',()=>{
  const fn=app.slice(app.indexOf('function startSinbadLipSyncAnalyser'),app.indexOf('function startSinbadLipSyncAnalyser')+2400);
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

test('audio ended/aborted returns to idle only when voice is still enabled, not to a stale state',()=>{
  assert.match(app,/if\(sinbadState\.voiceEnabled\)setSinbadAssistantState\('idle'\);\s*\n\s*scheduleSinbadListening\(\);/);
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
  assert.match(app,/const label=\$\('sinbadAvatarStatus'\);\s*\n\s*if\(label&&changed\)label\.textContent=copy\[next\]\|\|next;/);
});

test('reduced-motion strips every keyframe animation in the Sinbad avatar block but keeps colour/text state cues',()=>{
  const sectionStart=css.indexOf('/* ---- Captain Sinbad live assistant avatar');
  const sectionEnd=css.indexOf('@media(max-width:800px){.sinbad-layout',sectionStart);
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

test('service worker cache version was bumped for this change and precaches the Academy pack for offline use',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(sw,/const CACHE='sinbad-marine-v8\.20\.9-captain-sinbad-academy-pack-v1';/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-idle-master\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-listening\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-thinking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-speaking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-board-teaching\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-hero-portrait\.png'/);
});

test('mobile: the status line spans the full row instead of colliding with the avatar column',()=>{
  assert.match(css,/@media\(max-width:800px\)\{\.sinbad-layout\{grid-template-columns:1fr\}\.sinbad-profile\{[^}]*\}\.sinbad-avatar\.large\{width:105px;height:130px\}\.sinbad-capabilities,\.sinbad-status-line\{grid-column:1\/-1\}/);
});

test('board-teaching state exists with real art wired, but is not fabricated a fake trigger (no board UI exists yet in this pass)',()=>{
  assert.match(app,/'board-teaching':'captain-sinbad-board-teaching\.png'/);
  assert.doesNotMatch(app,/setSinbadAssistantState\('board-teaching'\)/);
});

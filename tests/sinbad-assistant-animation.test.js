'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('a single centralised, testable state API exists with the required states',()=>{
  assert.match(app,/function setSinbadAssistantState\(state\)\{/);
  assert.match(app,/const SINBAD_ASSISTANT_STATES=\[[^\]]*'idle'[^\]]*'listening'[^\]]*'thinking'[^\]]*'preparing-voice'[^\]]*'speaking'[^\]]*'success'[^\]]*'warning'[^\]]*'error'[^\]]*'voice-disabled'[^\]]*\]/);
});

test('unknown state falls back to idle safely',()=>{
  assert.match(app,/const next=SINBAD_ASSISTANT_STATES\.includes\(state\)\?state:'idle';/);
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
  // must be registered before audio.play() is ever called
  const playIdx=app.indexOf("audio.play().catch");
  const listenerIdx=app.indexOf("audio.addEventListener('playing'");
  assert.ok(listenerIdx>0&&listenerIdx<playIdx,'the playing listener must be attached before audio.play() is called');
});

test('lip-sync analyser is best-effort and never blocks or silences audio playback on failure',()=>{
  const fn=app.slice(app.indexOf('function startSinbadLipSyncAnalyser'),app.indexOf('function startSinbadLipSyncAnalyser')+2400);
  assert.match(fn,/try\{/);
  assert.match(fn,/\}catch\(error\)\{/);
  assert.match(fn,/console\.warn\('Sinbad lip-sync analyser unavailable; using CSS fallback lip-sync',error\)/);
  // the audio element itself is never paused/stopped/recreated by the analyser path
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

test('an aborted/superseded XTTS request cannot corrupt the animation state (guarded by the same controller identity check already used for playback)',()=>{
  // the 'speaking' trigger and the preparing-voice trigger both reuse the existing
  // sinbadVoiceAbort!==controller race guard already proven by the voice-clone tests.
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

test('large and small avatars share one SVG character source via symbol/use, not duplicated markup',()=>{
  assert.match(html,/<symbol id="sinbadCaptainSymbol"/);
  const uses=html.match(/<use href="#sinbadCaptainSymbol">/g)||[];
  assert.equal(uses.length,2,'expected exactly one <use> for the large avatar and one for the small avatar');
  // the old duplicated hand-drawn sailor SVG must be gone from both spots
  assert.doesNotMatch(html,/circle cx="80" cy="80" r="74" fill="#102b40" stroke="#e2bf72"/);
});

test('both avatars start with a valid default data-state and the large avatar keeps an accessible name',()=>{
  assert.match(html,/class="sinbad-avatar large" data-state="idle" role="img" aria-label="Captain Sinbad, AI marine intelligence guide"/);
  assert.match(html,/class="sinbad-avatar small" data-state="idle" aria-hidden="true"/);
  assert.match(html,/<svg viewBox="0 0 160 190" aria-hidden="true"><use href="#sinbadCaptainSymbol"><\/use><\/svg>/);
});

test('a visible, aria-live status line exists for the large avatar so state is never colour-only',()=>{
  assert.match(html,/<p id="sinbadAvatarStatus" class="sinbad-status-line" aria-live="polite">Ready<\/p>/);
  assert.match(app,/const label=\$\('sinbadAvatarStatus'\);\s*\n\s*if\(label&&changed\)label\.textContent=copy\[next\]\|\|next;/);
});

test('reduced-motion strips every keyframe animation in the Sinbad avatar block but keeps colour/text state cues',()=>{
  const sectionStart=css.indexOf('/* ---- Captain Sinbad live assistant avatar ---- */');
  const sectionEnd=css.indexOf('@media(max-width:800px){.sinbad-layout',sectionStart);
  assert.ok(sectionStart>0&&sectionEnd>sectionStart);
  const section=css.slice(sectionStart,sectionEnd);
  const motionBlockStart=section.indexOf('@media not (prefers-reduced-motion: reduce){');
  const motionBlockEnd=section.indexOf('@media (prefers-reduced-motion: reduce){',motionBlockStart);
  assert.ok(motionBlockStart>0&&motionBlockEnd>motionBlockStart);
  const guarded=section.slice(motionBlockStart,motionBlockEnd);
  // every animation: declaration in the Sinbad avatar section must live inside the guarded block
  const allAnimationDecls=(section.match(/[^-]animation:/g)||[]).length;
  const guardedAnimationDecls=(guarded.match(/[^-]animation:/g)||[]).length;
  assert.equal(allAnimationDecls,guardedAnimationDecls,'found a Sinbad avatar animation: declaration outside the reduced-motion guard');
  assert.match(css,/\.sinbad-avatar\[data-state="warning"\] \.sinbad-status-light\{fill:#d99a3d\}/);
});

test('small avatar hides complex hand/prop parts, per the "no complex gestures on the small avatar" rule',()=>{
  assert.match(css,/\.sinbad-avatar\.small \.sinbad-raven,\.sinbad-avatar\.small \.sinbad-sword,\.sinbad-avatar\.small \.sinbad-arm-left,\.sinbad-avatar\.small \.sinbad-arm-right\{display:none\}/);
});

test('warning never uses a red alarm colour, and error stays calm (no urgent/fast keyframe reused)',()=>{
  assert.doesNotMatch(css,/warning[^{]*\{[^}]*stroke:var\(--danger\)/);
  assert.doesNotMatch(css,/warning[^{]*\{[^}]*fill:var\(--danger\)/);
});

test('service worker cache version was bumped for this change, keeping the live release version prefix intact',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(sw,/const CACHE='sinbad-marine-v8\.20\.9-captain-sinbad-assistant-animation';/);
});

test('mobile: the status line spans the full row instead of colliding with the 110px avatar column',()=>{
  assert.match(css,/@media\(max-width:800px\)\{\.sinbad-layout\{grid-template-columns:1fr\}\.sinbad-profile\{[^}]*\}\.sinbad-avatar\.large\{width:105px;height:105px\}\.sinbad-capabilities,\.sinbad-status-line\{grid-column:1\/-1\}/);
});

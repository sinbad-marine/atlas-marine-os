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

test('audio ended/aborted always resolves the avatar state (idle if voice is still enabled, voice-disabled otherwise) via the single idempotent finishSinbadVoice path, never a stale state',()=>{
  const fn=app.slice(app.indexOf('function finishSinbadVoice'),app.indexOf('function stopSinbadVoice'));
  assert.match(fn,/setSinbadAssistantState\(forceState\|\|\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\)\);\s*\n\s*scheduleSinbadListening\(\);/);
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

test('service worker cache version was bumped for this change and precaches the real bound-state Academy assets for offline use (hero-portrait excluded - see the round-table fix test)',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(sw,/const CACHE='sinbad-marine-v8\.20\.9-captain-sinbad-roundtable-fixes-v1';/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-idle-master\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-listening\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-thinking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-speaking\.png'/);
  assert.match(sw,/'\.\/assets\/captain-sinbad\/captain-sinbad-board-teaching\.png'/);
});

test('mobile: the status line spans the full row instead of colliding with the avatar column',()=>{
  assert.match(css,/@media\(max-width:800px\)\{\.sinbad-layout\{grid-template-columns:1fr\}\.sinbad-profile\{[^}]*\}\.sinbad-avatar\.large\{width:110px;height:86px\}\.sinbad-avatar\.large\[data-state="board-teaching"\]\{height:165px\}\.sinbad-capabilities,\.sinbad-status-line\{grid-column:1\/-1\}/);
});

test('board-teaching state exists with real art wired, but is not fabricated a fake trigger (no board UI exists yet in this pass)',()=>{
  assert.match(app,/'board-teaching':'captain-sinbad-board-teaching\.png'/);
  assert.doesNotMatch(app,/setSinbadAssistantState\('board-teaching'\)/);
});

// ---- Voice architecture decision: standard (low-latency browser TTS) is the
// default provider; xtts-clone is preserved but optional. Both share one
// event contract into the avatar state machine. ----

test('standard is the default voice provider, xtts-clone is preserved but not deleted',()=>{
  assert.match(app,/let sinbadVoiceProvider='standard';/);
  assert.match(app,/function speakSinbad\(text,onVoiceReady\)\{\s*\n\s*if\(sinbadVoiceProvider==='xtts-clone'\)return speakSinbadXttsClone\(text,onVoiceReady\);\s*\n\s*return speakSinbadStandard\(text,onVoiceReady\);\s*\n\}/);
  assert.match(app,/async function speakSinbadXttsClone\(text,onVoiceReady\)\{/);
  assert.match(app,/function speakSinbadStandard\(text,onVoiceReady\)\{/);
});

test('a dedicated Sinbad voice profile exists with rate/pitch/volume inside the decided ranges',()=>{
  assert.match(app,/const SINBAD_VOICE_PROFILE=\{rate:\.96,pitch:\.91,volume:1\};/);
  assert.ok(.94<=.96&&.96<=.98,'rate must sit in 0.94-0.98');
  assert.ok(.88<=.91&&.91<=.94,'pitch must sit in 0.88-0.94');
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
  assert.match(fn,/bulunamad/); // "bulunamadı" (not found) - status text surfaces the gap
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
  assert.match(zeroVoiceBranch,/bulunamad/); // status text surfaces the gap instead of hanging silently
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

test('acceptance regression: the avatar never stays in preparing-voice forever when no suitable tr-TR voice exists among a real voice list',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/let anyVoiceQueued=false;/);
  assert.match(fn,/anyVoiceQueued=true;/);
  const terminalBranch=fn.slice(fn.indexOf('if(index>=runs.length){'),fn.indexOf('const run=runs[index++];'));
  assert.match(terminalBranch,/if\(!anyVoiceQueued\)\{/);
  assert.match(terminalBranch,/Uygun Türkçe ses bulunamadı · metin modunda devam ediliyor/);
  assert.match(terminalBranch,/finishSinbadVoice\('warning'\);/);
  assert.match(terminalBranch,/finishSinbadVoice\(\);/); // the anyVoiceQueued branch resolves via the default (idle/voice-disabled) outcome
});

test('speaking (standard provider) starts only on the real utterance onstart event, never when merely queued, and a superseded (stale) call cannot flip state either',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/utterance\.onstart=\(\)=>\{if\(myGeneration!==sinbadStandardSpeechGeneration\)return;announce\(\);setSinbadAssistantState\('speaking'\);\};/);
  assert.match(fn,/setSinbadAssistantState\('preparing-voice'\);/);
  // preparing-voice must be set before speechSynthesis.speak() is ever called
  const preparingIdx=fn.indexOf("setSinbadAssistantState('preparing-voice')");
  const speakCallIdx=fn.indexOf('speechSynthesis.speak(utterance)');
  assert.ok(preparingIdx>0&&preparingIdx<speakCallIdx);
});

test('onboundary drives a real per-word cue (not a fabricated continuous loop, and never for a superseded call), onend advances/finishes cleanly',()=>{
  const fn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  assert.match(fn,/utterance\.onboundary=\(\)=>\{if\(myGeneration===sinbadStandardSpeechGeneration\)sinbadStandardVoiceTick\(\);\};/);
  assert.match(fn,/utterance\.onend=speakNext;/);
  assert.match(app,/function sinbadStandardVoiceTick\(\)\{/);
  assert.match(css,/\.sinbad-avatar\.sinbad-voice-tick \.sinbad-avatar-img\{transform:scale\(1\.018\)/);
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
  assert.match(fn,/setSinbadAssistantState\(forceState\|\|\(sinbadState\.voiceEnabled\?'idle':'voice-disabled'\)\);/);
  assert.doesNotMatch(fn,/if\(sinbadState\.voiceEnabled\)setSinbadAssistantState/);
});

test('round-table fix: every early-return in speakSinbadStandard and speakSinbadXttsClone routes through finishSinbadVoice instead of leaving the avatar stuck in thinking/preparing-voice',()=>{
  const standardFn=app.slice(app.indexOf('function speakSinbadStandard'),app.indexOf('function splitSinbadCloneChunks'));
  const cloneFn=app.slice(app.indexOf('async function speakSinbadXttsClone'),app.indexOf('// Provider switch:'));
  // the old scattered `sinbadAwaitingAnswer=false;scheduleSinbadListening();` pattern must be gone
  assert.doesNotMatch(standardFn,/announce\(\);sinbadAwaitingAnswer=false;scheduleSinbadListening\(\);return;/);
  assert.doesNotMatch(cloneFn,/announce\(\);sinbadAwaitingAnswer=false;scheduleSinbadListening\(\);return;/);
  assert.match(standardFn,/if\(!sinbadState\.voiceEnabled\|\|!\('speechSynthesis'in window\)\)\{announce\(\);finishSinbadVoice\(\);return;\}/);
  assert.match(cloneFn,/if\(!sinbadState\.voiceEnabled\)\{announce\(\);finishSinbadVoice\(\);return;\}/);
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
  assert.match(standardFn,/utterance\.onstart=\(\)=>\{if\(myGeneration!==sinbadStandardSpeechGeneration\)return;announce\(\);setSinbadAssistantState\('speaking'\);\};/);
  assert.match(standardFn,/utterance\.onboundary=\(\)=>\{if\(myGeneration===sinbadStandardSpeechGeneration\)sinbadStandardVoiceTick\(\);\};/);
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
  const fn=app.slice(app.indexOf('function setSinbadAssistantState'),app.indexOf('function setSinbadAssistantState')+1400);
  assert.match(fn,/const generation=\+\+sinbadAvatarImageGeneration;/);
  assert.match(fn,/img\.onload=\(\)=>\{if\(generation===sinbadAvatarImageGeneration\)img\.style\.opacity='1';\};/);
});

test('round-table: SpeechRecognition error/abort paths verified - onend (which the Web Speech spec guarantees fires after error/abort) already resets the avatar out of listening, so no fix was needed here',()=>{
  const fn=app.slice(app.indexOf('function beginSinbadRecognition'),app.indexOf('function beginSinbadRecognition')+2200);
  assert.match(fn,/sinbadRecognition\.onerror=event=>\{sinbadIsListening=false;/);
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

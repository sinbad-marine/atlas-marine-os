const test=require('node:test');
const assert=require('node:assert/strict');
const {PERFORMANCES,CUE_SEQUENCES,THINKING_STAGE_CUES,IMPROVISATION_POOLS,cueAt,speechModeForDecision,speechCueForBoundary,listeningCueForActivity,thinkingCueForStage,responseCueForText,textPresentationCues,createImprovisationDirector,createPerformanceDirector}=require('../sinbad-performance-director.js');

test('board teaching performance is bounded, immutable and alternates board with audience',()=>{
  const cues=PERFORMANCES['board-teaching'];assert.equal(cues.length,4);assert.ok(Object.isFrozen(cues));
  assert.deepEqual(cues.map(cue=>cue.gaze),['board','audience','board','audience']);assert.ok(cues.at(-1).at<=5000);
});

test('lesson opening walks through alternating real frames before teaching',()=>{
  const cues=PERFORMANCES['lesson-opening'];assert.equal(cues.length,8);assert.ok(Object.isFrozen(cues));
  assert.deepEqual(cues.slice(0,6).map(cue=>cue.walkFrame),[0,1,0,1,0,1]);
  assert.deepEqual(cues.slice(0,6).map(cue=>cue.state),Array(6).fill('walking'));
  assert.deepEqual(cues.slice(6).map(cue=>cue.state),['board-teaching','board-teaching']);
  assert.equal(cues[6].at,1680);assert.ok(cues.at(-1).at<=3500);
});

test('reduced motion skips lesson walking and lands directly at the board',()=>{
  const seen=[],director=createPerformanceDirector();const result=director.play('lesson-opening',cue=>seen.push(cue),{reducedMotion:true});
  assert.equal(result.accepted,true);assert.equal(result.cueCount,1);assert.equal(seen[0].state,'board-teaching');assert.equal(seen[0].at,0);
});

test('director emits the first cue immediately and schedules a finite performance',()=>{
  const scheduled=[],seen=[],director=createPerformanceDirector({setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},clearTimeout:()=>{}});
  const result=director.play('board-teaching',cue=>seen.push(cue));assert.equal(result.accepted,true);assert.equal(result.cueCount,4);assert.equal(seen.length,1);assert.deepEqual(scheduled.map(item=>item.ms),[1500,3000,4500]);
});

test('cancel invalidates stale cues and reduced motion emits one cue only',()=>{
  const scheduled=[],seen=[],director=createPerformanceDirector({setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout:()=>{}});
  director.play('board-teaching',cue=>seen.push(cue));director.cancel();scheduled.forEach(fn=>fn());assert.equal(seen.length,1);
  const reduced=[];const result=director.play('board-teaching',cue=>reduced.push(cue),{reducedMotion:true});assert.equal(result.cueCount,1);assert.equal(reduced.length,1);
});

test('unknown performances and invalid emitters fail closed',()=>{
  const director=createPerformanceDirector();assert.equal(director.play('dance',()=>{}).reason,'UNKNOWN_PERFORMANCE');assert.equal(director.play('board-teaching',null).reason,'INVALID_EMITTER');
});

test('real speech boundaries resolve to a deterministic bounded gesture sequence',()=>{
  assert.ok(Object.isFrozen(CUE_SEQUENCES.speaking));
  assert.deepEqual([0,1,2,3,4].map(index=>cueAt('speaking',index).cue.gesture),['explain','open-hand','explain','nod','explain']);
  assert.equal(cueAt('dance',0).reason,'UNKNOWN_CUE_SEQUENCE');assert.equal(cueAt('speaking',-1).reason,'INVALID_CUE_INDEX');
});

test('real recognition activity maps to restrained listening cues',()=>{
  assert.deepEqual([0,1,2,3].map(index=>cueAt('listening',index).cue.gesture),['listen-lean','listen-lean','hold','nod']);
  assert.deepEqual([0,1,2,3].map(index=>cueAt('listening',index).cue.energy),[.28,.46,.62,.34]);
});

test('structured Core decisions select conservative speech performance modes',()=>{
  assert.equal(speechModeForDecision({intent:'emergency',emergency:true,risk:'critical'}),'caution');
  assert.equal(speechModeForDecision({intent:'navigation',risk:'medium'}),'instructional');
  assert.equal(speechModeForDecision({intent:'general',risk:'low'}),'warm');
  assert.equal(speechModeForDecision(null),'warm');
  assert.equal(cueAt('speaking-caution',0).cue.emotion,'concerned');
});

test('real text boundaries produce sentence-aware speaking cadence',()=>{
  assert.deepEqual(speechCueForBoundary({text:'Merhaba dünya.',name:'word',charIndex:0,wordIndex:0,mode:'warm'}).cue,{gesture:'open-hand',gaze:'audience',emotion:'warm',cadence:'opening',responseKind:'conversation'});
  assert.deepEqual(speechCueForBoundary({text:'Bir, iki',name:'word',charIndex:4,wordIndex:1,mode:'warm'}).cue,{gesture:'hold',gaze:'thought',emotion:'attentive',cadence:'pause'});
  assert.deepEqual(speechCueForBoundary({text:'Hazır mısın? Evet.',name:'word',charIndex:12,wordIndex:2,mode:'warm'}).cue,{gesture:'open-hand',gaze:'audience',emotion:'curious',cadence:'question'});
  assert.deepEqual(speechCueForBoundary({text:'Tamam. Sonra',name:'sentence',charIndex:7,wordIndex:1,mode:'instructional'}).cue,{gesture:'nod',gaze:'audience',emotion:'confident',cadence:'sentence-end'});
});

test('caution cadence never turns a safety statement into a playful question cue',()=>{
  assert.deepEqual(speechCueForBoundary({text:'Onay var mı? Bekle.',name:'sentence',charIndex:12,wordIndex:2,mode:'caution'}).cue,{gesture:'nod',gaze:'audience',emotion:'attentive',cadence:'sentence-end'});
  assert.equal(speechCueForBoundary(null).reason,'INVALID_BOUNDARY');
  assert.equal(speechCueForBoundary({text:'x',charIndex:9,wordIndex:0}).reason,'INVALID_BOUNDARY');
});

test('real recognition activity has restrained progress and pause cues',()=>{
  assert.equal(listeningCueForActivity('ready').cue.gesture,'listen-lean');
  assert.equal(listeningCueForActivity('sound').cue.gesture,'open-hand');
  assert.equal(listeningCueForActivity('speech').cue.energy,.46);
  assert.deepEqual([0,1,2,3].map(revision=>listeningCueForActivity('interim',revision).cue.gesture),['listen-lean','listen-lean','hold','listen-lean']);
  assert.equal(listeningCueForActivity('pause').cue.gaze,'thought');
  assert.equal(listeningCueForActivity('processed').cue.gesture,'nod');
  assert.equal(listeningCueForActivity('invented').reason,'UNKNOWN_LISTENING_ACTIVITY');
  assert.equal(listeningCueForActivity('interim',-1).reason,'INVALID_LISTENING_REVISION');
});

test('real thinking work maps to distinct restrained and fail-closed stage cues',()=>{
  assert.ok(Object.isFrozen(THINKING_STAGE_CUES));
  assert.deepEqual(thinkingCueForStage('analyzing').cue,{gesture:'hold',gaze:'thought',emotion:'curious',energy:.32});
  assert.equal(thinkingCueForStage('calculating').cue.gaze,'board');
  assert.equal(thinkingCueForStage('retrieving').cue.emotion,'attentive');
  assert.equal(thinkingCueForStage('composing').cue.gesture,'nod');
  assert.equal(thinkingCueForStage('pretending').reason,'UNKNOWN_THINKING_STAGE');
});

test('real answer meaning selects a deterministic opening reaction without random animation',()=>{
  assert.equal(responseCueForText('Dikkat: rota emniyet sınırını aşıyor.','warm').cue.responseKind,'caution');
  assert.equal(responseCueForText('Bu yöntemi birlikte deneyelim mi?','warm').cue.responseKind,'question');
  assert.equal(responseCueForText('Rota başarıyla oluşturuldu.','warm').cue.responseKind,'completion');
  assert.equal(responseCueForText('Bu, adım adım açıklanan öğretici bir yanıttır.','instructional').cue.responseKind,'explanation');
  assert.equal(responseCueForText('Merhaba Kaptan.','warm').cue.responseKind,'conversation');
  assert.equal(responseCueForText('   ','warm').reason,'INVALID_RESPONSE_TEXT');
  assert.equal(responseCueForText('Harika mı?','caution').cue.responseKind,'caution');
});

test('speech boundaries follow the meaning of each real sentence instead of freezing one emotion for the whole answer',()=>{
  const text='Dikkat: sığlık var. Şimdi normal açıklamaya geçiyorum. Hazır mısınız?';
  const warning=speechCueForBoundary({text,name:'word',charIndex:0,wordIndex:0,mode:'warm'}).cue;
  const explanation=speechCueForBoundary({text,name:'word',charIndex:text.indexOf('Şimdi'),wordIndex:3,mode:'warm'}).cue;
  const question=speechCueForBoundary({text,name:'word',charIndex:text.indexOf('Hazır'),wordIndex:7,mode:'warm'}).cue;
  assert.equal(warning.responseKind,'caution');assert.equal(warning.emotion,'concerned');
  assert.equal(explanation.responseKind,'conversation');assert.equal(explanation.emotion,'warm');
  assert.equal(question.responseKind,'question');assert.equal(question.emotion,'curious');
});

test('text-only presentation follows at most three real sentence meanings on a bounded timeline',()=>{
  const result=textPresentationCues('Dikkat: sığlık var. Rota başarıyla oluşturuldu. Hazır mısınız? Dördüncü cümle.','warm');
  assert.equal(result.accepted,true);
  assert.deepEqual(result.cues.map(cue=>cue.at),[0,550,1100]);
  assert.deepEqual(result.cues.map(cue=>cue.responseKind),['caution','completion','question']);
  assert.ok(Object.isFrozen(result.cues));
  assert.equal(textPresentationCues('  ').reason,'INVALID_RESPONSE_TEXT');
});

test('improvisation chooses context-safe variants without immediately repeating the same action',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const first=director.choose('question'),second=director.choose('question');
  assert.equal(first.accepted,true);assert.equal(second.accepted,true);
  assert.notEqual(first.cue.variantId,second.cue.variantId);
  assert.equal(first.cue.emotion,'curious');
  assert.ok(Object.isFrozen(IMPROVISATION_POOLS));assert.ok(Object.isFrozen(first.cue));
});

test('improvisation is injectable for tests and fails closed for invalid context or entropy',()=>{
  const high=createImprovisationDirector({entropy:()=>.999999}).choose('conversation');
  assert.equal(high.cue.variantId,'conversation-rest');
  assert.equal(createImprovisationDirector({entropy:()=>1}).choose('conversation').reason,'INVALID_ENTROPY');
  assert.equal(createImprovisationDirector().choose('unsafe-dance').reason,'UNKNOWN_RESPONSE_KIND');
});

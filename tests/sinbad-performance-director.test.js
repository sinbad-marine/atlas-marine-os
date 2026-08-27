const test=require('node:test');
const assert=require('node:assert/strict');
const {PERFORMANCES,CUE_SEQUENCES,LISTENING_MEANING_POOLS,THINKING_STAGE_CUES,IMPROVISATION_POOLS,MOTION_PROFILES,IDLE_MICRO_CUES,GESTURE_SEQUENCE_STYLES,GESTURE_CAPABILITIES,cueAt,speechModeForDecision,speechEmphasisForBoundary,speechCueForBoundary,speechTransitionForKinds,listeningCueForActivity,listeningPauseForPace,listeningCueForPace,listeningCueForText,thinkingCueForStage,responseCueForText,textPresentationCues,gestureRequestForText,gestureAcknowledgementForRequest,gestureCapabilityForRequest,groundResponseWithGesture,gestureRecallAnswerForText,characterStateAnswerForText,academyBoardRecallAnswerForText,academyBoardRepeatRequestForText,academyBoardClearRequestForText,academyBoardResizeRequestForText,academyBoardSizeRecallAnswerForText,academyBoardShapeExplanationForText,academyBoardShapePropertyAnswerForText,academyBoardShapePropertyReasonForText,academyBoardShapeCheckForText,academyBoardShapeCheckAnswerForText,academyBoardShapeCheckRepeatForText,academyBoardShapeCheckHintForText,academyBoardShapeCheckRevealForText,academyBoardShapeCheckReasonForText,createAcademyBoardQuestionDirector,recordVerifiedGesture,gestureHistoryAnswerForText,gestureHistoryReplayForText,gestureStopRequestForText,reducedMotionCommandForText,gestureSequenceForRequest,createGestureSequenceDirector,gazeTransitionForCue,createListeningReactionDirector,createIdleBehaviorDirector,createImprovisationDirector,createSpeechGestureDirector,createPerformanceDirector}=require('../sinbad-performance-director.js');

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

test('every advertised gesture has a registered and executable capability mode',()=>{
  const samples=[
    ['Avucunu göster','sequence'],['Sağ elini göster','sequence'],['Sol elini göster','sequence'],['İki elini göster','sequence'],['El salla','sequence'],
    ['Başını sola çevir','pose'],['Başını sağa çevir','pose'],['Başını ortaya çevir','pose'],['Tahtaya bak','pose'],['Başını iki yana salla','sequence'],
    ['Omuzlarını silk','sequence'],['Başını eğ','sequence'],['Gülümse','pose'],['Kahkaha at','sequence'],['Tahtayı işaret et','sequence'],
    ['Dinlediğini göster','pose'],['Yürü','direct-character'],['Tahtaya Pruva 090 yaz','academy'],['Tahtaya bir daire çiz','academy']
  ];
  for(const [text,mode] of samples){
    const request=gestureRequestForText(text),capability=gestureCapabilityForRequest(request);
    assert.equal(request.supported,true,text);assert.equal(capability.accepted,true,text);assert.equal(capability.mode,mode,text);
  }
  assert.equal(new Set(Object.values(GESTURE_CAPABILITIES).flat()).size,Object.values(GESTURE_CAPABILITIES).flat().length);
});

test('gesture capability registry fails closed for invented actions and missing execution gates',()=>{
  assert.deepEqual(gestureCapabilityForRequest({accepted:true,supported:true,action:'teleport',cue:{gesture:'rest'}}),{accepted:false,reason:'UNREGISTERED_GESTURE_CAPABILITY'});
  assert.deepEqual(gestureCapabilityForRequest({accepted:true,supported:true,action:'walk',cue:{gesture:'walk'}}),{accepted:false,reason:'CHARACTER_CONTROLLER_REQUIRED'});
  assert.deepEqual(gestureCapabilityForRequest({accepted:true,supported:true,action:'write-board',boardText:'x',cue:{gesture:'point-board'}}),{accepted:false,reason:'ACADEMY_GATE_REQUIRED'});
  assert.deepEqual(gestureCapabilityForRequest({accepted:true,supported:true,action:'two-hand-sequence',actions:['show-right-hand','show-right-hand']}),{accepted:false,reason:'INVALID_COMPOUND_GESTURE'});
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
  assert.deepEqual(speechCueForBoundary({text:'Bir, iki',name:'word',charIndex:4,wordIndex:1,mode:'warm'}).cue,{gesture:'hold',gaze:'thought',emotion:'attentive',cadence:'pause',responseKind:'conversation'});
  assert.deepEqual(speechCueForBoundary({text:'Hazır mısın? Evet.',name:'word',charIndex:12,wordIndex:2,mode:'warm'}).cue,{gesture:'open-hand',gaze:'audience',emotion:'curious',cadence:'question',responseKind:'question'});
  assert.deepEqual(speechCueForBoundary({text:'Tamam. Sonra',name:'sentence',charIndex:7,wordIndex:1,mode:'instructional'}).cue,{gesture:'nod',gaze:'audience',emotion:'confident',cadence:'sentence-end',responseKind:'explanation'});
});

test('real connective words create bounded semantic emphasis instead of a fixed beat',()=>{
  assert.deepEqual(speechEmphasisForBoundary('Önce rotayı kontrol et.',0),{accepted:true,reason:'sequence',token:'Önce',cue:{gesture:'explain',gaze:'audience',emotion:'confident',energy:.36}});
  assert.equal(speechEmphasisForBoundary('Rota uygun, ancak hava değişiyor.',12).reason,'contrast');
  assert.equal(speechEmphasisForBoundary('Plain words only.',0).reason,'NO_EMPHASIS');
  assert.equal(speechEmphasisForBoundary('x',9).reason,'INVALID_EMPHASIS_BOUNDARY');
  const sequence=speechCueForBoundary({text:'Önce rotayı kontrol et.',name:'word',charIndex:0,wordIndex:0,mode:'instructional'}).cue;
  assert.equal(sequence.cadence,'emphasis');assert.equal(sequence.emphasisReason,'sequence');assert.equal(sequence.responseKind,'explanation');
  const contrast=speechCueForBoundary({text:'Rota uygun ama görüş azalıyor.',name:'word',charIndex:11,wordIndex:2,mode:'warm'}).cue;
  assert.equal(contrast.cadence,'emphasis');assert.equal(contrast.emphasisReason,'contrast');
});

test('safety speech does not let lexical emphasis override caution choreography',()=>{
  const cue=speechCueForBoundary({text:'Ancak tehlike sürüyor.',name:'word',charIndex:0,wordIndex:0,mode:'caution'}).cue;
  assert.notEqual(cue.cadence,'emphasis');assert.equal(cue.responseKind,'caution');
});

test('caution cadence never turns a safety statement into a playful question cue',()=>{
  const cue=speechCueForBoundary({text:'Onay var mı? Bekle.',name:'sentence',charIndex:12,wordIndex:2,mode:'caution'}).cue;
  assert.deepEqual(cue,{gesture:'hold',gaze:'audience',emotion:'concerned',energy:.28,cadence:'sentence-end',responseKind:'caution'});
  assert.notEqual(cue.gesture,'nod');
  assert.equal(speechCueForBoundary(null).reason,'INVALID_BOUNDARY');
  assert.equal(speechCueForBoundary({text:'x',charIndex:9,wordIndex:0}).reason,'INVALID_BOUNDARY');
});

test('real recognition activity has restrained progress and pause cues',()=>{
  assert.equal(listeningCueForActivity('ready').cue.gesture,'listen-lean');
  assert.equal(listeningCueForActivity('sound').cue.gesture,'listen-orient');
  assert.equal(listeningCueForActivity('speech').cue.gesture,'listen-follow');
  assert.equal(listeningCueForActivity('speech').cue.energy,.46);
  assert.deepEqual([0,1,2,3].map(revision=>listeningCueForActivity('interim',revision).cue.gesture),['listen-follow','listen-follow','hold','listen-follow']);
  assert.equal(listeningCueForActivity('pause').cue.gaze,'thought');
  assert.equal(listeningCueForActivity('processed').cue.gesture,'nod');
  assert.equal(listeningCueForActivity('invented').reason,'UNKNOWN_LISTENING_ACTIVITY');
  assert.equal(listeningCueForActivity('interim',-1).reason,'INVALID_LISTENING_REVISION');
});

test('turn pause follows measured speech pace within humane safety bounds',()=>{
  assert.deepEqual(listeningPauseForPace('bu kısa',300),{accepted:true,pace:'short-fragment',words:2,wpm:null,pauseMs:850});
  assert.equal(listeningPauseForPace('bir iki üç dört beş',4000).pauseMs,1100);
  assert.equal(listeningPauseForPace('bir iki üç dört beş',2500).pauseMs,850);
  assert.equal(listeningPauseForPace('bir iki üç dört beş',1600).pauseMs,700);
  assert.equal(listeningPauseForPace('bir iki üç dört beş',900).pauseMs,550);
  assert.equal(listeningPauseForPace(' ',1000).reason,'INVALID_SPEECH_SAMPLE');
  assert.equal(listeningPauseForPace('merhaba',0).reason,'INVALID_SPEECH_DURATION');
});

test('continuation body language visibly follows the measured speaking pace',()=>{
  assert.equal(listeningCueForPace('short-fragment').cue.gesture,'listen-follow');
  assert.equal(listeningCueForPace('slow').cue.gaze,'thought');
  assert.equal(listeningCueForPace('measured').cue.gesture,'listen-lean');
  assert.equal(listeningCueForPace('conversational').cue.gesture,'listen-follow');
  assert.equal(listeningCueForPace('fast').cue.gesture,'listen-orient');
  assert.equal(listeningCueForPace('invented').reason,'UNKNOWN_SPEECH_PACE');
});

test('idle micro-behaviors are sparse, bounded and do not immediately repeat',()=>{
  const director=createIdleBehaviorDirector({entropy:()=>0});
  const first=director.select(),second=director.select(),third=director.select(),next=director.select();
  assert.equal(IDLE_MICRO_CUES.length,3);assert.ok(Object.isFrozen(IDLE_MICRO_CUES));
  assert.deepEqual([first.cue.idleMotion,second.cue.idleMotion,third.cue.idleMotion],['breathe','look-left','look-right']);
  assert.notEqual(next.cue.idleMotion,third.cue.idleMotion);
  assert.ok([first,second,third,next].every(item=>item.delayMs>=6500&&item.delayMs<=11000&&item.cue.holdMs<=1100&&item.cue.energy<=.12));
  assert.equal(createIdleBehaviorDirector({entropy:()=>1}).select().reason,'INVALID_ENTROPY');
});

test('heard words select bounded semantic listening reactions without executing commands',()=>{
  assert.deepEqual(listeningCueForText('Sinbad, neden böyle oldu?',1),{accepted:true,meaning:'question',cue:{gesture:'listen-follow',gaze:'audience',emotion:'curious',energy:.44}});
  assert.equal(listeningCueForText('Dikkat, makine dairesinde yangın var.',2).meaning,'caution');
  assert.equal(listeningCueForText('Dikkat, makine dairesinde yangın var.',2).cue.emotion,'concerned');
  assert.equal(listeningCueForText('Teşekkür ederim, harika oldu.',3).meaning,'positive');
  assert.equal(listeningCueForText('Bugün rotayı konuşalım.',0).meaning,'neutral');
  assert.equal(listeningCueForText(' ',0).reason,'INVALID_LISTENING_TEXT');
  assert.equal(listeningCueForText('Merhaba',-1).reason,'INVALID_LISTENING_REVISION');
});

test('live listening distinguishes greeting uncertainty and bounded disagreement',()=>{
  assert.deepEqual(listeningCueForText('Günaydın Sinbad.',0),{accepted:true,meaning:'greeting',cue:{gesture:'listen-orient',gaze:'audience',emotion:'warm',energy:.34}});
  assert.equal(listeningCueForText('Kafam karıştı, emin değilim.',1).meaning,'uncertainty');
  assert.equal(listeningCueForText("I don't understand.",1).cue.gaze,'thought');
  assert.equal(listeningCueForText('Hayır.',0).meaning,'negative');
  assert.equal(listeningCueForText('Hayır, neden böyle yaptın?',0).meaning,'question');
  assert.equal(listeningCueForText('Dur, anlamadım.',0).meaning,'caution');
});

test('uncertain listening can use the real shrug pose without deterministic repetition',()=>{
  const director=createListeningReactionDirector({entropy:()=>.999});
  const first=director.select('Emin değilim, kafam karıştı.',1);
  assert.equal(first.meaning,'uncertainty');assert.equal(first.reactionId,'uncertainty-shrug');assert.equal(first.cue.gesture,'shrug');
  const second=director.select('Emin değilim, kafam karıştı.',2);
  assert.notEqual(second.reactionId,first.reactionId);
});

test('new semantic listening pools vary without playful or command-like reactions',()=>{
  const director=createListeningReactionDirector({entropy:()=>0});
  for(const [text,meaning] of [['Merhaba Sinbad.','greeting'],['Anlamadım.','uncertainty'],['Hayır.','negative']]){
    const first=director.select(text,0),second=director.select(text,1);
    assert.equal(first.meaning,meaning);assert.equal(second.meaning,meaning);assert.notEqual(first.reactionId,second.reactionId);
    assert.ok([first,second].every(item=>item.cue.energy<=.34&&!['laugh','walk','wave-right'].includes(item.cue.gesture)));
  }
});

test('semantic listening reactions vary without immediate repetition and remain safety-bounded',()=>{
  const samples=[.01,.01,.01,.01,.01,.01];let index=0;
  const director=createListeningReactionDirector({entropy:()=>samples[index++]});
  const questions=[0,1,2].map(revision=>director.select('Bunu nasıl yapacağız?',revision));
  assert.equal(new Set(questions.map(item=>item.reactionId)).size,3);
  assert.ok(questions.every(item=>item.meaning==='question'&&item.cue.emotion==='curious'));
  const cautions=[director.select('Dikkat, yangın var.',3),director.select('Dikkat, yangın var.',4)];
  assert.notEqual(cautions[0].reactionId,cautions[1].reactionId);
  assert.ok(cautions.every(item=>item.cue.emotion==='concerned'&&!['laugh','walk','open-hand'].includes(item.cue.gesture)));
  assert.equal(Object.isFrozen(LISTENING_MEANING_POOLS),true);
  assert.equal(director.select('Sıradan bir cümle.',5).meaning,'neutral');
  assert.equal(createListeningReactionDirector({entropy:()=>1}).select('Neden?',0).reason,'INVALID_ENTROPY');
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

test('epistemic uncertainty uses a bounded reflective speech repertoire',()=>{
  const cue=responseCueForText('Bu sonucu doğrulayamıyorum; yeterli kanıt yok.','warm').cue;
  assert.equal(cue.responseKind,'uncertainty');assert.equal(cue.gesture,'shrug');assert.equal(cue.emotion,'curious');
  assert.equal(responseCueForText("I don't know; there is insufficient evidence.",'warm').cue.responseKind,'uncertainty');
  const director=createImprovisationDirector({entropy:()=>0});
  const first=director.choose('uncertainty','speech',{preferredFamily:'reflective',preferenceReason:'EPISTEMIC_UNCERTAINTY'});
  assert.equal(first.accepted,true);assert.equal(first.cue.gestureFamily,'reflective');assert.equal(first.cue.semanticPreference,'EPISTEMIC_UNCERTAINTY');
});

test('factual corrections use corrective body language without affirmative closure',()=>{
  const semantic=responseCueForText('Bu cevap doğru değil; bilgiyi düzeltiyorum.','warm').cue;
  assert.equal(semantic.responseKind,'correction');assert.equal(semantic.gesture,'shake-head-left');assert.equal(semantic.emotion,'attentive');
  assert.equal(responseCueForText('This result is incorrect; I need to correct it.','warm').cue.responseKind,'correction');
  const text='Bu bilgi yanlış.';
  const ending=speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:2,mode:'warm'}).cue;
  assert.equal(ending.responseKind,'correction');assert.equal(ending.gesture,'hold');assert.notEqual(ending.gesture,'nod');
  const director=createSpeechGestureDirector({entropy:()=>0});
  const opening=director.select({cadence:'opening',responseKind:'correction',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}).cue;
  assert.equal(opening.gestureFamily,'corrective');assert.equal(opening.semanticPreference,'FACTUAL_CORRECTION');
  director.select({cadence:'word',responseKind:'correction',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32});
  const settled=director.select({cadence:'word',responseKind:'correction',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}).cue;
  assert.equal(settled.gesture,'hold');assert.equal(settled.emotion,'attentive');
});

test('explicit refusals remain calm and never resolve as agreement',()=>{
  const semantic=responseCueForText('Hayır, bunu yapamam; nedenini açıklayacağım.','warm').cue;
  assert.equal(semantic.responseKind,'negative');assert.equal(semantic.gesture,'shake-head-left');assert.equal(semantic.emotion,'attentive');
  assert.equal(responseCueForText("No, I cannot do that; I will explain why.",'warm').cue.responseKind,'negative');
  const text='Bu isteği uygulayamam.';
  const ending=speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:3,mode:'warm'}).cue;
  assert.equal(ending.responseKind,'negative');assert.equal(ending.gesture,'hold');assert.notEqual(ending.gesture,'nod');
  const director=createSpeechGestureDirector({entropy:()=>0});
  const opening=director.select({cadence:'opening',responseKind:'negative',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3}).cue;
  assert.equal(opening.gestureFamily,'corrective');assert.equal(opening.semanticPreference,'EXPLICIT_REFUSAL');
  director.select({cadence:'word',responseKind:'negative',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3});
  const settled=director.select({cadence:'word',responseKind:'negative',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3}).cue;
  assert.equal(settled.gesture,'hold');assert.equal(settled.emotion,'attentive');
  const variation=createImprovisationDirector({entropy:()=>0});
  const first=variation.choose('negative','speech',{preferredFamily:'corrective',preferenceReason:'EXPLICIT_REFUSAL'}).cue;
  const second=variation.choose('negative','speech',{preferredFamily:'corrective',preferenceReason:'EXPLICIT_REFUSAL'}).cue;
  assert.equal(first.gestureFamily,'corrective');assert.equal(second.gestureFamily,'corrective');assert.notEqual(first.gesture,second.gesture);
});

test('uncertain speech never settles with an affirmative nod',()=>{
  const text='Bu sonucu doğrulayamıyorum.';
  const ending=speechCueForBoundary({text,name:'sentence',charIndex:text.length,wordIndex:3,mode:'warm'}).cue;
  assert.equal(ending.responseKind,'uncertainty');assert.equal(ending.gesture,'hold');assert.equal(ending.gaze,'thought');assert.notEqual(ending.gesture,'nod');
  const director=createSpeechGestureDirector({entropy:()=>0});
  director.select({cadence:'opening',responseKind:'uncertainty',gesture:'shrug',gaze:'thought',emotion:'curious',energy:.32});
  director.select({cadence:'word',responseKind:'uncertainty',gesture:'shrug',gaze:'thought',emotion:'curious',energy:.32});
  const settled=director.select({cadence:'word',responseKind:'uncertainty',gesture:'shrug',gaze:'thought',emotion:'curious',energy:.32});
  assert.equal(settled.cue.gesture,'hold');assert.equal(settled.cue.gaze,'thought');assert.equal(settled.cue.emotion,'curious');
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

test('meaning changes use a brief bridge while safety escalation remains immediate',()=>{
  const normal={gesture:'open-hand',gaze:'audience',emotion:'warm',responseKind:'conversation'};
  const caution={gesture:'hold',gaze:'audience',emotion:'concerned',responseKind:'caution'};
  const question={gesture:'open-hand',gaze:'audience',emotion:'curious',responseKind:'question'};
  assert.equal(speechTransitionForKinds('conversation',normal).changed,false);
  const escalation=speechTransitionForKinds('conversation',caution);assert.equal(escalation.immediate,true);assert.equal(escalation.durationMs,0);
  const recovery=speechTransitionForKinds('caution',question);assert.equal(recovery.immediate,false);assert.equal(recovery.durationMs,180);assert.equal(recovery.bridgeCue.gesture,'hold');
  assert.equal(speechTransitionForKinds('',null).reason,'INVALID_SPEECH_TRANSITION');
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

test('improvisation exhausts a shuffled context bag before reusing a variant',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const cycle=Array.from({length:IMPROVISATION_POOLS.question.length},()=>director.choose('question').cue.variantId);
  assert.equal(new Set(cycle).size,IMPROVISATION_POOLS.question.length);
  const next=director.choose('question').cue.variantId;
  assert.notEqual(next,cycle.at(-1));
});

test('correction improvisation varies without ever signalling a correct answer',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const gestures=Array.from({length:IMPROVISATION_POOLS.correction.length},()=>director.choose('correction','board-assessment').cue.gesture);
  assert.equal(new Set(gestures).size,IMPROVISATION_POOLS.correction.length);
  assert.ok(gestures.every(gesture=>['shake-head-left','shake-head-right','open-hand','hold','explain'].includes(gesture)));
  assert.equal(gestures.includes('nod'),false);
});

test('improvisation avoids repeating the same physical gesture across response kinds',()=>{
  const samples=[0,0,0,0,.34,0];
  const director=createImprovisationDirector({entropy:()=>samples.shift()??0});
  const question=director.choose('question','answer');
  const conversation=director.choose('conversation','answer');
  const explanation=director.choose('explanation','speech');
  assert.equal(question.cue.gesture,'open-hand');
  assert.notEqual(conversation.cue.gesture,question.cue.gesture);
  assert.notEqual(explanation.cue.gesture,conversation.cue.gesture);
  director.reset();
  assert.equal(director.choose('question','answer').cue.gesture,'open-hand');
});

test('each gesture receives one of six non-repeating bounded motion profiles',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const profiles=Array.from({length:MOTION_PROFILES.length},()=>director.choose('conversation').cue.motionProfile);
  assert.equal(new Set(profiles).size,MOTION_PROFILES.length);
  assert.equal(MOTION_PROFILES.length,6);assert.ok(Object.isFrozen(MOTION_PROFILES));
  assert.notEqual(director.choose('conversation').cue.motionProfile,profiles.at(-1));
});

test('improvisation balances recent gesture families across the whole performance',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const selected=Array.from({length:4},()=>director.choose('conversation').cue);
  assert.deepEqual(selected.map(cue=>cue.gestureFamily),['expansive','affirming','neutral','expansive']);
  assert.ok(selected.every((cue,index)=>index<2||cue.gestureFamily!==selected[index-1].gestureFamily));
  director.reset();assert.equal(director.choose('conversation').cue.gestureFamily,'expansive');
});

test('expansive improvisation alternates real left and right rig sides when both remain eligible',()=>{
  const director=createImprovisationDirector({entropy:()=>0});
  const sides=Array.from({length:8},()=>director.choose('conversation').cue).filter(cue=>cue.gestureSide!=='center').map(cue=>cue.gestureSide);
  assert.deepEqual(sides.slice(0,4),['right','left','right','left']);
});

test('strong speech meaning prefers a compatible family without disabling variation',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0});
  const caution=director.select({cadence:'opening',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned'}).cue;
  assert.equal(caution.gestureFamily,'reflective');assert.equal(caution.semanticPreference,'SAFETY_CAUTION');
  director.reset();
  const question=director.select({cadence:'question',responseKind:'question',gesture:'open-hand',gaze:'audience',emotion:'curious'}).cue;
  assert.equal(question.gestureFamily,'expansive');assert.equal(question.semanticPreference,'INVITE_RESPONSE');
  director.reset();
  const completion=director.select({cadence:'sentence-end',responseKind:'completion',gesture:'nod',gaze:'audience',emotion:'confident'}).cue;
  assert.equal(completion.gestureFamily,'affirming');assert.equal(completion.semanticPreference,'RESOLUTION');
});

test('unknown semantic family fails closed instead of silently selecting an unrelated pose',()=>{
  const result=createImprovisationDirector({entropy:()=>0}).choose('conversation','speech',{preferredFamily:'teleport'});
  assert.equal(result.accepted,false);assert.equal(result.reason,'UNKNOWN_GESTURE_FAMILY');
});

test('improvisation is injectable for tests and fails closed for invalid context or entropy',()=>{
  const high=createImprovisationDirector({entropy:()=>.999999}).choose('conversation');
  assert.equal(high.cue.variantId,'conversation-rest');
  assert.equal(createImprovisationDirector({entropy:()=>1}).choose('conversation').reason,'INVALID_ENTROPY');
  assert.equal(createImprovisationDirector().choose('unsafe-dance').reason,'UNKNOWN_RESPONSE_KIND');
});

test('explicit gesture requests override improvisation only when a real supported pose exists',()=>{
  const palm=gestureRequestForText('Sinbad avucunun içinde bir şey mi var? Avucunu açar mısın?');
  assert.equal(palm.supported,true);assert.equal(palm.action,'show-palm');assert.equal(palm.cue.gesture,'show-palm');
  const leftPalm=gestureRequestForText('Sinbad sol avucunda bir şey mi var?');
  assert.equal(leftPalm.supported,true);assert.equal(leftPalm.action,'raise-left-hand');assert.equal(leftPalm.palmSide,'left');assert.equal(leftPalm.cue.gesture,'show-left-palm');assert.equal(leftPalm.cue.gaze,'left-palm');
  const bothPalms=gestureRequestForText('İki avucunda da bir şey var mı?');
  assert.equal(bothPalms.supported,true);assert.equal(bothPalms.action,'show-both-hands');assert.equal(bothPalms.palmSide,'both');assert.equal(bothPalms.cue.gesture,'show-both-hands');
  const board=gestureRequestForText('Bunu tahtada göster.');
  assert.equal(board.supported,true);assert.equal(board.cue.gesture,'point-board');assert.equal(board.cue.gaze,'board');
  const writing=gestureRequestForText('Tahtaya Pruva 090 yaz.');assert.equal(writing.supported,true);assert.equal(writing.directAcademyBoard,true);assert.equal(writing.boardText,'Pruva 090');
  const circle=gestureRequestForText('Tahtaya bir daire çiz.');assert.equal(circle.supported,true);assert.equal(circle.directAcademyBoard,true);assert.equal(circle.boardShape,'circle');
  assert.equal(gestureRequestForText('Tahtaya bir üçgen çiz.').boardShape,'triangle');
  assert.equal(gestureRequestForText('Draw a rectangle on the board.').boardShape,'rectangle');
  assert.equal(gestureRequestForText('Tahtaya bir ok çiz.').boardShape,'arrow');
  assert.equal(gestureRequestForText('Tahtaya koordinat eksenleri çiz.').boardShape,'axes');
  assert.equal(gestureRequestForText('Tahtaya bir ok çiz.').boardShape,'arrow');
  assert.equal(gestureRequestForText('Tahtaya koordinat eksenleri çiz.').boardShape,'axes');
  assert.equal(gestureRequestForText('Beni dinliyor musun?').reason,'NO_GESTURE_REQUEST');
  const listening=gestureRequestForText('Dinlediğini göster.');
  assert.equal(listening.action,'show-listening');assert.equal(listening.cue.gesture,'listen-lean');
  assert.equal(gestureRequestForText('Sağ elini göster.').action,'show-right-hand');
  assert.equal(gestureRequestForText('Sol elini kaldır.').cue.gesture,'show-left-palm');
  assert.equal(gestureRequestForText('İki elini aynı anda göster.').action,'show-both-hands');
  assert.equal(gestureRequestForText('Sinbad bana el sallar mısın?').action,'wave');
  assert.equal(gestureRequestForText('Başını sola çevir.').cue.gesture,'look-left');
  assert.equal(gestureRequestForText('Başını sağa döndür.').cue.gesture,'look-right');
  const turnRight=gestureRequestForText('sağa dön sinbad');assert.equal(turnRight.action,'turn-right');assert.equal(turnRight.cue.gesture,'turn-right');
  const turnLeft=gestureRequestForText('Sinbad sola dön.');assert.equal(turnLeft.action,'turn-left');assert.equal(turnLeft.cue.gesture,'turn-left');
  const centered=gestureRequestForText('Tekrar bana bak.');assert.equal(centered.action,'look-center');assert.equal(centered.cue.gesture,'rest');assert.equal(centered.cue.gaze,'audience');
  assert.equal(gestureRequestForText('Turn your head back to center.').action,'look-center');
  const lookBoard=gestureRequestForText('Tahtaya bak.');assert.equal(lookBoard.action,'look-board');assert.equal(lookBoard.cue.gesture,'rest');assert.equal(lookBoard.cue.gaze,'board');
  assert.equal(gestureRequestForText('Hayır anlamında başını salla.').action,'shake-head');
  assert.equal(gestureRequestForText('Başını eğ.').cue.gesture,'nod');
  assert.equal(gestureRequestForText('Gülümse lütfen.').action,'smile');
  assert.equal(gestureRequestForText('Sinbad biraz gülsene.').action,'laugh');
  const walk=gestureRequestForText('Sinbad biraz yürü.');assert.equal(walk.action,'walk');assert.equal(walk.directCharacterReaction,true);
  assert.equal(gestureRequestForText('Sinbad dans et.').supported,false);
  assert.equal(gestureRequestForText('Bugün hava güzel.').reason,'NO_GESTURE_REQUEST');
  assert.equal(gestureRequestForText(' ').reason,'INVALID_REQUEST_TEXT');
});

test('supported physical requests expand into bounded interruptible gesture sequences',()=>{
  const palm=gestureSequenceForRequest('show-palm');
  assert.equal(palm.accepted,true);assert.deepEqual(palm.cues.map(cue=>cue.gesture),['open-hand','show-palm','show-palm']);
  assert.deepEqual(palm.cues.map(cue=>cue.gaze),['audience','palm','audience']);assert.ok(palm.duration<=1200);assert.ok(Object.isFrozen(palm.cues));
  const left=gestureSequenceForRequest('raise-left-hand');assert.deepEqual(left.cues.map(cue=>cue.gaze),['audience','left-palm','audience']);assert.deepEqual(left.cues.map(cue=>cue.gesture),['rest','show-left-palm','show-left-palm']);
  const both=gestureSequenceForRequest('show-both-hands');assert.deepEqual(both.cues.map(cue=>cue.gesture),['rest','open-hand','show-both-hands','rest']);assert.ok(both.duration<=1400);
  const board=gestureSequenceForRequest('point-board');assert.equal(board.cues[1].gaze,'board');assert.ok(board.duration<=1200);
  const wave=gestureSequenceForRequest('wave');assert.deepEqual(wave.cues.map(cue=>cue.gesture),['open-hand','wave-right','wave-right-away','wave-right','wave-right-away','open-hand']);assert.ok(wave.duration<=1800);
  const laugh=gestureSequenceForRequest('laugh');assert.deepEqual(laugh.cues.map(cue=>cue.gesture),['rest','laugh','nod','laugh','rest']);assert.ok(laugh.duration<=1500);
  const no=gestureSequenceForRequest('shake-head');assert.deepEqual(no.cues.map(cue=>cue.gesture),['rest','shake-head-left','shake-head-right','shake-head-left','rest']);assert.ok(no.duration<=1800);
  const yes=gestureSequenceForRequest('nod');assert.deepEqual(yes.cues.map(cue=>cue.gesture),['rest','nod','nod-up','nod','rest']);assert.ok(yes.duration<=1400);
  assert.equal(gestureSequenceForRequest('smile').reason,'NO_GESTURE_SEQUENCE');
});

test('explicit gestures vary their bounded lead-in without changing the requested action',()=>{
  const director=createGestureSequenceDirector({entropy:()=>0});
  const plans=Array.from({length:3},()=>director.select('show-palm'));
  assert.equal(GESTURE_SEQUENCE_STYLES.length,3);assert.equal(new Set(plans.map(plan=>plan.variantId)).size,3);
  assert.ok(plans.every(plan=>plan.accepted&&plan.duration<=1200&&plan.cues.some(cue=>cue.gesture==='show-palm')));
  assert.ok(plans.every(plan=>plan.cues.every((cue,index)=>index===0||cue.at>=plan.cues[index-1].at)));
  const next=director.select('show-palm');assert.notEqual(next.variantId,plans.at(-1).variantId);
  director.reset();assert.equal(director.select('show-palm').variantId,'direct');
});

test('gesture variation preserves compound action evidence and fails closed',()=>{
  const director=createGestureSequenceDirector({entropy:()=>.5});
  const plan=director.select('two-hand-sequence',{actions:['show-right-hand','raise-left-hand']});
  assert.equal(plan.accepted,true);assert.deepEqual(plan.actions,['show-right-hand','raise-left-hand']);
  assert.deepEqual(plan.cues.filter(cue=>cue.actionStart).map(cue=>cue.actionStart),plan.actions);
  assert.ok(plan.duration<=2800);assert.equal(Object.isFrozen(plan.cues),true);
  assert.equal(director.select('teleport').reason,'NO_GESTURE_SEQUENCE');
  assert.equal(createGestureSequenceDirector({entropy:()=>1}).select('nod').reason,'INVALID_ENTROPY');
});

test('an explicit two-hand instruction becomes one bounded ordered gesture plan',()=>{
  const request=gestureRequestForText('Önce sağ elini göster, sonra sol elini kaldır.');
  assert.equal(request.compound,true);assert.deepEqual(request.actions,['show-right-hand','raise-left-hand']);assert.equal(request.responsePolicy,'replace');
  const plan=gestureSequenceForRequest(request.action,{actions:request.actions});
  assert.equal(plan.accepted,true);assert.ok(plan.duration<=2400);assert.deepEqual(plan.actions,request.actions);
  assert.deepEqual(plan.cues.filter(cue=>cue.actionStart).map(cue=>cue.actionStart),request.actions);
  assert.ok(plan.cues.every((cue,index)=>index===0||cue.at>=plan.cues[index-1].at));
  assert.match(groundResponseWithGesture('irrelevant',request,'tr-TR').text,/^Önce sağ avucumu, ardından sol elimi/);
  assert.equal(gestureSequenceForRequest('two-hand-sequence',{actions:['show-right-hand','show-right-hand']}).reason,'INVALID_COMPOUND_GESTURE');
});

test('spoken gesture acknowledgement is grounded in the action the rig can actually perform',()=>{
  const palm=gestureRequestForText('Sinbad avucunu açar mısın?');
  assert.deepEqual(gestureAcknowledgementForRequest(palm,'tr-TR'),{accepted:true,supported:true,action:'show-palm',text:'Avucumu açıp gösteriyorum.'});
  const grounded=groundResponseWithGesture('Sorunu da yanıtlayayım.',gestureRequestForText('Sol elini kaldır.'),'tr-TR');
  assert.equal(grounded.grounded,true);assert.equal(grounded.action,'raise-left-hand');assert.match(grounded.text,/^Sol elimi kaldırıp gösteriyorum\./);
  assert.match(groundResponseWithGesture('Here is the answer.',gestureRequestForText('Show your right hand.'),'en-US').text,/^I am opening and showing my right palm\./);
  assert.match(gestureAcknowledgementForRequest(gestureRequestForText('Sol avucunda ne var?'),'tr-TR').text,/^Sol avucumu açıp gösteriyorum/);
  assert.match(gestureAcknowledgementForRequest(gestureRequestForText('İki avucunda da ne var?'),'tr-TR').text,/^İki avucumu birlikte gösteriyorum/);
  const shrug=gestureRequestForText('Sinbad, omuzlarını silk.');assert.equal(shrug.action,'shrug');assert.equal(shrug.cue.gesture,'shrug');
  assert.equal(gestureAcknowledgementForRequest(shrug,'tr-TR').text,'Omuzlarımı silkerek karşılık veriyorum.');
  const shrugSequence=gestureSequenceForRequest('shrug');assert.equal(shrugSequence.accepted,true);assert.equal(shrugSequence.cues[1].gesture,'shrug');assert.equal(shrugSequence.cues.at(-1).gesture,'rest');
});

test('a direct question about Sinbad body state replaces unrelated model text with a visible grounded answer',()=>{
  const request=gestureRequestForText('Sinbad avucunun içinde bir şey mi var? Avucunu açar mısın?');
  assert.equal(request.semantic,'palm-object-query');assert.equal(request.responsePolicy,'replace');assert.equal(request.cue.gaze,'palm');
  const grounded=groundResponseWithGesture('Atlas kitaplığında güçlü bir eşleşme bulamadım.',request,'tr-TR');
  assert.equal(grounded.text,'Avucumu açıp gösteriyorum; mevcut karakter görünümünde avucumda bir nesne gösterilmiyor.');
  assert.doesNotMatch(grounded.text,/Atlas kitaplığında/);
  const english=groundResponseWithGesture('No library match.',gestureRequestForText('Is there anything in your palm?'),'en-US');
  assert.match(english.text,/shows no object/);assert.doesNotMatch(english.text,/library/i);
});

test('unimplemented physical requests are acknowledged without inventing an action',()=>{
  const writing=gestureRequestForText('Tahtaya bir yıldız çiz.');
  assert.equal(writing.accepted,true);assert.equal(writing.supported,false);assert.equal(writing.reason,'GESTURE_NOT_IMPLEMENTED');
  const grounded=groundResponseWithGesture('İstersen konuyu açıklayabilirim.',writing,'tr-TR');
  assert.equal(grounded.grounded,true);assert.equal(grounded.supported,false);assert.match(grounded.text,/^Bu hareketi henüz güvenilir biçimde yapamıyorum\./);
  assert.equal(gestureAcknowledgementForRequest({accepted:true,supported:true,action:'teleport'}).reason,'UNMAPPED_GESTURE_ACTION');
  assert.equal(groundResponseWithGesture('',writing).reason,'INVALID_RESPONSE_TEXT');
});

test('a hexagon request becomes a bounded verified Academy board action',()=>{
  const request=gestureRequestForText('Tahtaya bir altıgen çiz.');
  assert.equal(request.accepted,true);assert.equal(request.supported,true);assert.equal(request.directAcademyBoard,true);
  assert.equal(request.action,'draw-board-shape');assert.equal(request.boardShape,'hexagon');assert.equal(request.cue.gesture,'point-board');
  assert.equal(gestureAcknowledgementForRequest(request,'tr-TR').text,'Academy tahtasına bir altıgen çiziyorum.');
  assert.match(gestureAcknowledgementForRequest(gestureRequestForText('Draw a hexagon on the board.'),'en-US').text,/drawing a hexagon/);
});

test('follow-up body questions answer only from a verified performed-action record',()=>{
  const known=gestureRecallAnswerForText('Hangi elini kaldırdın?','raise-left-hand','tr-TR');
  assert.deepEqual(known,{accepted:true,known:true,action:'raise-left-hand',text:'Sol elimi kaldırıp gösterdim.'});
  const english=gestureRecallAnswerForText('Which hand did you show?','show-right-hand','en-US');
  assert.match(english.text,/right palm/);assert.equal(english.known,true);
  const unknown=gestureRecallAnswerForText('Az önce ne yaptın?',null,'tr-TR');
  assert.equal(unknown.accepted,true);assert.equal(unknown.known,false);assert.match(unknown.text,/doğrulanmış bir hareket kaydım/);
  assert.equal(gestureRecallAnswerForText('Bugün ne öğreneceğiz?','raise-left-hand').reason,'NO_GESTURE_RECALL_REQUEST');
});

test('why questions for hands and board use only the verified last explicit action',()=>{
  const palm=gestureRecallAnswerForText('Neden avucunu açtın?','show-right-hand','tr-TR');
  assert.deepEqual(palm,{accepted:true,known:true,kind:'gesture-reason',action:'show-right-hand',cue:{gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.38},text:'Elimi görünür biçimde göstermek ve soruna beden diliyle karşılık vermek için avucumu açmıştım; şimdi yeniden gösteriyorum.'});
  assert.match(gestureRecallAnswerForText('Why did you show your palm?','raise-left-hand','en-US').text,/showing it again now/);
  const board=gestureRecallAnswerForText('Tahtayı neden işaret ettin?','point-board','tr-TR');assert.equal(board.known,true);assert.match(board.text,/doğrulanmış tahta içeriğine/);
  assert.equal(gestureRecallAnswerForText('Neden avucunu açtın?','point-board','tr-TR').known,false);
  assert.equal(gestureRecallAnswerForText('Neden tahtayı işaret ettin?','show-palm','tr-TR').known,false);
});

test('why questions for wave and laugh replay only the matching verified action',()=>{
  const wave=gestureRecallAnswerForText('Neden bana el salladın?','wave','tr-TR');
  assert.equal(wave.known,true);assert.equal(wave.action,'wave');assert.equal(wave.cue.gesture,'wave-right');assert.match(wave.text,/şimdi yeniden sallıyorum/);
  assert.match(gestureRecallAnswerForText('Why did you laugh?','laugh','en-US').text,/another short laugh now/);
  assert.equal(gestureRecallAnswerForText('Neden el salladın?','laugh','tr-TR').known,false);
  assert.equal(gestureRecallAnswerForText('Neden güldün?','wave','tr-TR').known,false);
});

test('why questions for head direction replay only the exact verified side',()=>{
  const left=gestureRecallAnswerForText('Neden başını sola çevirdin?','look-left','tr-TR');
  assert.equal(left.known,true);assert.equal(left.action,'look-left');assert.equal(left.cue.gesture,'look-left');assert.match(left.text,/şimdi yeniden çeviriyorum/);
  const right=gestureRecallAnswerForText('Why did you turn your head right?','look-right','en-US');assert.equal(right.known,true);assert.match(right.text,/right.*again now/);
  assert.equal(gestureRecallAnswerForText('Neden başını sağa çevirdin?','look-left','tr-TR').known,false);
  assert.equal(gestureRecallAnswerForText('Neden başını sola çevirdin?','wave','tr-TR').known,false);
});

test('board confirmation gestures explain their reason only with matching verified context',()=>{
  const no=gestureRecallAnswerForText('Neden başını iki yana salladın?','shake-head','tr-TR','board-confirmation-no');assert.equal(no.known,true);assert.equal(no.cue.gaze,'board');assert.match(no.text,/hayır cevabımı/);
  const yes=gestureRecallAnswerForText('Neden başını eğdin?','nod','tr-TR','board-confirmation-yes');assert.equal(yes.known,true);assert.equal(yes.cue.gesture,'nod');assert.match(yes.text,/evet cevabımı/);
  assert.equal(gestureRecallAnswerForText('Neden başını eğdin?','nod','tr-TR').reason,'NO_GESTURE_RECALL_REQUEST');
  assert.equal(gestureRecallAnswerForText('Neden başını eğdin?','nod','tr-TR','board-confirmation-no').reason,'NO_GESTURE_RECALL_REQUEST');
  assert.equal(gestureRecallAnswerForText('Neden başını iki yana salladın?','shake-head','tr-TR','board-confirmation-yes').reason,'NO_GESTURE_RECALL_REQUEST');
  assert.equal(gestureRecallAnswerForText('Neden başını eğdin?','wave','tr-TR','board-confirmation-yes').known,false);
  assert.equal(gestureRecallAnswerForText('Neden başını iki yana salladın?','look-board','tr-TR','board-confirmation-no').known,false);
  assert.equal(gestureRecallAnswerForText('Why did you shake your head?','shake-head','en-US','board-confirmation-no').known,true);
});

test('returning to center is a distinct verified movement and can be repeated safely',()=>{
  const centered=gestureRequestForText('Başını ortaya çevir.');
  assert.equal(centered.action,'look-center');assert.equal(centered.responsePolicy,'replace');
  assert.equal(gestureAcknowledgementForRequest(centered,'tr-TR').text,'Başımı yeniden ortaya çevirip sana bakıyorum.');
  const repeated=gestureRequestForText('Aynı hareketi tekrar yap.',{lastAction:'look-center'});
  assert.equal(repeated.supported,true);assert.equal(repeated.action,'look-center');assert.equal(repeated.cue.gesture,'rest');
  assert.equal(gestureRecallAnswerForText('Az önce ne yaptın?','look-center','tr-TR').text,'Başımı ortaya çevirip sana baktım.');
});

test('looking at the board is distinct from pointing and remains repeatable',()=>{
  const request=gestureRequestForText('Tahtaya bak.');
  assert.equal(request.action,'look-board');assert.equal(request.cue.gesture,'rest');assert.equal(request.cue.gaze,'board');
  assert.equal(gestureAcknowledgementForRequest(request,'tr-TR').text,'Bakışımı tahtaya çeviriyorum.');
  const repeated=gestureRequestForText('Aynı hareketi tekrar yap.',{lastAction:'look-board'});
  assert.equal(repeated.action,'look-board');assert.equal(repeated.cue.gaze,'board');
  assert.equal(gestureRecallAnswerForText('Az önce ne yaptın?','look-board','tr-TR').text,'Bakışımı tahtaya çevirdim.');
  assert.equal(gestureRequestForText('Tahtayı işaret et.').action,'point-board');
});

test('why Sinbad looked at the board replays only an exact verified look action',()=>{
  const known=gestureRecallAnswerForText('Neden tahtaya baktın?','look-board','tr-TR');
  assert.equal(known.known,true);assert.equal(known.action,'look-board');assert.equal(known.cue.gesture,'rest');assert.equal(known.cue.gaze,'board');assert.match(known.text,/yeniden tahtaya bakıyorum/);
  assert.match(gestureRecallAnswerForText('Why did you look at the board?','look-board','en-US').text,/looking at the board again/);
  assert.equal(gestureRecallAnswerForText('Neden tahtaya baktın?','point-board','tr-TR').known,false);
  assert.equal(gestureRecallAnswerForText('Neden tahtayı işaret ettin?','look-board','tr-TR').known,false);
});

test('why a center return happened is answered only from the exact verified movement',()=>{
  const known=gestureRecallAnswerForText('Neden tekrar bana baktın?','look-center','tr-TR');
  assert.equal(known.known,true);assert.equal(known.action,'look-center');assert.equal(known.cue.gesture,'rest');assert.equal(known.cue.gaze,'audience');assert.match(known.text,/şimdi yeniden sana bakıyorum/);
  assert.match(gestureRecallAnswerForText('Why did you turn your head back to center?','look-center','en-US').text,/looking at you again now/);
  assert.equal(gestureRecallAnswerForText('Neden başını ortaya çevirdin?','look-left','tr-TR').known,false);
  assert.equal(gestureRecallAnswerForText('Neden tekrar bana baktın?','wave','tr-TR').known,false);
});

test('questions about current gaze answer only from the verified character snapshot',()=>{
  const palm=characterStateAnswerForText('Sinbad, nereye bakıyorsun?',{state:'presenting',gaze:'palm'},'tr-TR');
  assert.deepEqual(palm,{accepted:true,known:true,kind:'gaze',value:'palm',text:'Sağ avucuma bakıyorum.'});
  assert.match(characterStateAnswerForText('What are you looking at?',{state:'board-teaching',gaze:'board'},'en-US').text,/board/);
  const unknown=characterStateAnswerForText('Nereye bakıyorsun?',{state:'idle',gaze:'invented'},'tr-TR');
  assert.equal(unknown.accepted,true);assert.equal(unknown.known,false);assert.match(unknown.text,/tahmin yürütmeyeceğim/);
});

test('questions asking whether Sinbad looks at the user use the exact verified gaze target',()=>{
  assert.deepEqual(characterStateAnswerForText('Şu an bana mı bakıyorsun?',{state:'presenting',gaze:'audience'},'tr-TR'),{accepted:true,known:true,kind:'audience-gaze',value:true,target:'audience',text:'Evet, şu an sana bakıyorum.'});
  const board=characterStateAnswerForText('Bana bakıyor musun?',{state:'board-teaching',gaze:'board'},'tr-TR');assert.equal(board.value,false);assert.equal(board.target,'board');assert.match(board.text,/tahtaya bakıyorum/);
  assert.match(characterStateAnswerForText('Are you looking at me right now?',{state:'presenting',gaze:'audience'},'en-US').text,/Yes/);
  assert.equal(characterStateAnswerForText('Bana mı bakıyorsun?',{state:'idle',gaze:'unknown'},'tr-TR').known,false);
});

test('questions about current activity never infer beyond the verified state',()=>{
  const listening=characterStateAnswerForText('Şu an ne yapıyorsun?',{state:'listening',gaze:'audience'},'tr-TR');
  assert.deepEqual(listening,{accepted:true,known:true,kind:'state',value:'listening',text:'Şu an seni dinliyorum.'});
  assert.match(characterStateAnswerForText('What are you doing right now?',{state:'walking',gaze:'path'},'en-US').text,/short walk/);
  assert.equal(characterStateAnswerForText('Şu an ne yapıyorsun?',null,'tr-TR').known,false);
  assert.equal(characterStateAnswerForText('Bugün ne öğreneceğiz?',{state:'idle',gaze:'audience'}).reason,'NO_CHARACTER_STATE_REQUEST');
  assert.equal(characterStateAnswerForText(' ',{state:'idle'}).reason,'INVALID_CHARACTER_STATE_TEXT');
});

test('microphone listening answers use only the measured recognition state',()=>{
  assert.deepEqual(characterStateAnswerForText('Beni dinliyor musun?',{listeningActive:true},'tr-TR'),{accepted:true,known:true,kind:'listening-status',value:true,text:'Evet; mikrofon dinleme oturumu şu an etkin ve seni dinliyorum.'});
  assert.match(characterStateAnswerForText('Beni duyuyor musun?',{listeningActive:false},'tr-TR').text,/Yazdığın mesajı okuyorum/);
  assert.equal(characterStateAnswerForText('Are you listening to me?',{listeningActive:true},'en-US').value,true);
  assert.equal(characterStateAnswerForText('Mikrofonun açık mı?',{},'tr-TR').known,false);
});

test('questions about head direction answer only from the measured visible rig direction',()=>{
  assert.deepEqual(characterStateAnswerForText('Başın şu an hangi tarafa dönük?',{state:'speaking',headDirection:'left'},'tr-TR'),{accepted:true,known:true,kind:'head-direction',value:'left',text:'Başım şu an sola dönük.'});
  assert.match(characterStateAnswerForText('Which way is your head facing?',{state:'idle',headDirection:'center'},'en-US').text,/centered/);
  assert.equal(characterStateAnswerForText('Başın hangi tarafa dönük?',{state:'idle',headDirection:'unknown'},'tr-TR').known,false);
});

test('questions about head tilt answer only from the measured visible rig pitch',()=>{
  assert.deepEqual(characterStateAnswerForText('Başın şu an yukarı mı eğik?',{state:'speaking',headTilt:'up'},'tr-TR'),{accepted:true,known:true,kind:'head-tilt',value:'up',text:'Başım şu an yukarı doğru eğik.'});
  assert.match(characterStateAnswerForText('Is your head tilted down?',{state:'idle',headTilt:'down'},'en-US').text,/downward/);
  assert.match(characterStateAnswerForText('Başını hangi yöne eğdin?',{state:'idle',headTilt:'level'},'tr-TR').text,/düz ve dengeli/);
  assert.equal(characterStateAnswerForText('Başın aşağı mı eğik?',{state:'idle',headTilt:'unknown'},'tr-TR').known,false);
});

test('questions about facial expression answer only from the measured visible rig smile',()=>{
  assert.deepEqual(characterStateAnswerForText('Şu an gülümsüyor musun?',{state:'speaking',facialExpression:'smiling'},'tr-TR'),{accepted:true,known:true,kind:'facial-expression',value:'smiling',text:'Evet, şu an gülümsüyorum.'});
  assert.match(characterStateAnswerForText('What is your facial expression?',{state:'idle',facialExpression:'neutral'},'en-US').text,/calm and neutral/);
  assert.match(characterStateAnswerForText('Yüz ifaden nasıl?',{state:'warning',facialExpression:'concerned'},'tr-TR').text,/kaygılı ve dikkatli/);
  assert.equal(characterStateAnswerForText('Gülümsüyor musun?',{state:'idle',facialExpression:'unknown'},'tr-TR').known,false);
});

test('questions about posture answer only from the measured visible rig lean',()=>{
  assert.deepEqual(characterStateAnswerForText('Şu an öne mi eğildin?',{state:'listening',bodyPosture:'forward'},'tr-TR'),{accepted:true,known:true,kind:'body-posture',value:'forward',text:'Şu an gövdem öne doğru eğik.'});
  assert.match(characterStateAnswerForText('Are you leaning back?',{state:'idle',bodyPosture:'back'},'en-US').text,/leaning back/);
  assert.match(characterStateAnswerForText('Duruşun nasıl?',{state:'idle',bodyPosture:'upright'},'tr-TR').text,/dik ve dengeli/);
  assert.equal(characterStateAnswerForText('Duruşun nasıl?',{state:'idle',bodyPosture:'unknown'},'tr-TR').known,false);
});

test('questions about movement energy answer only from the measured visible rig energy',()=>{
  assert.deepEqual(characterStateAnswerForText('Hareket enerjin nasıl?',{state:'walking',motionEnergy:'high'},'tr-TR'),{accepted:true,known:true,kind:'motion-energy',value:'high',text:'Şu an animasyon hareket enerjim yüksek.'});
  assert.match(characterStateAnswerForText('What is your movement energy?',{state:'idle',motionEnergy:'low'},'en-US').text,/low and calm/);
  assert.match(characterStateAnswerForText('Animasyon yoğunluğun ne durumda?',{state:'presenting',motionEnergy:'medium'},'tr-TR').text,/orta düzeyde/);
  assert.equal(characterStateAnswerForText('Ne kadar hareketlisin?',{state:'idle',motionEnergy:'unknown'},'tr-TR').known,false);
});

test('reduced-motion questions answer only from the measured browser preference',()=>{
  assert.deepEqual(characterStateAnswerForText('Hareket azaltma açık mı?',{reducedMotion:true},'tr-TR'),{accepted:true,known:true,kind:'reduced-motion',value:true,text:'Evet, hareket azaltma tercihi şu an açık; uzun animasyon dizilerini oynatmıyorum.'});
  assert.equal(characterStateAnswerForText('Animasyon azaltma etkin mi?',{reducedMotion:false},'tr-TR').value,false);
  assert.match(characterStateAnswerForText('Is reduced motion enabled?',{reducedMotion:true},'en-US').text,/Yes, reduced motion is enabled/);
  assert.equal(characterStateAnswerForText('Hareket azaltma açık mı?',{},'tr-TR').known,false);
});

test('a pose summary composes only fully measured visible rig controls',()=>{
  const snapshot={state:'presenting',headDirection:'left',headTilt:'level',bodyPosture:'upright',facialExpression:'neutral',motionEnergy:'medium'};
  const result=characterStateAnswerForText('Şu an pozun nasıl?',snapshot,'tr-TR');
  assert.equal(result.accepted,true);assert.equal(result.known,true);assert.equal(result.kind,'pose-summary');
  assert.deepEqual(result.value,{headDirection:'left',headTilt:'level',bodyPosture:'upright',facialExpression:'neutral',motionEnergy:'medium'});
  assert.equal(result.text,'gövdem dik; başım sola dönük ve düz; yüzüm sakin ve nötr; hareket enerjim orta.');
  assert.match(characterStateAnswerForText('Describe your current pose',snapshot,'en-US').text,/my body is upright; my head is turned left and level/);
  assert.equal(characterStateAnswerForText('Beden durumun nasıl?',{...snapshot,motionEnergy:'unknown'},'tr-TR').known,false);
});

test('questions about the active hand answer only from the verified visible side',()=>{
  assert.deepEqual(characterStateAnswerForText('Hangi elini kullanıyorsun?',{state:'speaking',gestureSide:'left'},'tr-TR'),{accepted:true,known:true,kind:'gesture-side',value:'left',text:'Şu an sol kolumu kullanıyorum.'});
  assert.match(characterStateAnswerForText('Which hand are you using?',{state:'speaking',gestureSide:'right'},'en-US').text,/right arm/);
  assert.match(characterStateAnswerForText('Sağ mı sol mu?',{state:'idle',gestureSide:'center'},'tr-TR').text,/merkezî/);
  assert.equal(characterStateAnswerForText('Hangi kolunu kullanıyorsun?',{state:'speaking'},'tr-TR').known,false);
  assert.deepEqual(characterStateAnswerForText('Hangi elini kullanıyorsun?',{state:'speaking',gestureSide:'center',gestureHands:'both'},'tr-TR'),{accepted:true,known:true,kind:'gesture-hands',value:'both',text:'Şu an iki elimi birlikte kullanıyorum.'});
  assert.deepEqual(characterStateAnswerForText('Hangi elini kullanıyorsun?',{state:'idle',gestureSide:'center',gestureHands:'none'},'tr-TR'),{accepted:true,known:true,kind:'gesture-hands',value:'none',text:'Şu an belirgin bir el hareketi kullanmıyorum; ellerim dinlenme pozunda.'});
});

test('questions about a head shake explain only a verified spoken gesture reason',()=>{
  const negative=characterStateAnswerForText('Neden başını iki yana salladın?',{state:'idle',lastSpeechGesture:{gesture:'shake-head-right',responseKind:'negative',ageMs:500}},'tr-TR');
  assert.deepEqual(negative,{accepted:true,known:true,kind:'gesture-reason',value:'negative',text:'Olumsuz yanıt verdiğimi beden diliyle açıkça göstermek için başımı iki yana salladım.'});
  const correction=characterStateAnswerForText('Why did you shake your head?',{state:'idle',lastSpeechGesture:{gesture:'shake-head-left',responseKind:'correction',ageMs:1000}},'en-US');
  assert.match(correction.text,/correction would not be mistaken for agreement/);
  const unknown=characterStateAnswerForText('Başını sağa sola neden salladın?',{state:'idle',lastSpeechGesture:null},'tr-TR');
  assert.equal(unknown.accepted,true);assert.equal(unknown.known,false);assert.match(unknown.text,/neden uydurmayacağım/);
  const forged=characterStateAnswerForText('Neden başını iki yana salladın?',{state:'idle',lastSpeechGesture:{gesture:'nod',responseKind:'negative',ageMs:100}},'tr-TR');
  assert.equal(forged.known,false);
  assert.equal(characterStateAnswerForText('Neden başını iki yana salladın?',{state:'idle',lastSpeechGesture:{gesture:'shake-head-left',responseKind:'negative',ageMs:120001}},'tr-TR').known,false);
});

test('questions about a shrug explain only a verified uncertainty gesture',()=>{
  const known=characterStateAnswerForText('Neden omuzlarını silktin?',{state:'idle',lastSpeechGesture:{gesture:'shrug',responseKind:'uncertainty',ageMs:250}},'tr-TR');
  assert.deepEqual(known,{accepted:true,known:true,kind:'gesture-reason',value:'uncertainty',text:'Sonucun kesin olmadığını ve kanıtın yetersiz kaldığını beden diliyle göstermek için omuzlarımı silktim.'});
  assert.match(characterStateAnswerForText('Why did you shrug?',{state:'idle',lastSpeechGesture:{gesture:'shrug',responseKind:'uncertainty',ageMs:1000}},'en-US').text,/evidence was insufficient/);
  const unknown=characterStateAnswerForText('Omuzlarını neden silktin?',{state:'idle',lastSpeechGesture:{gesture:'shrug',responseKind:'conversation',ageMs:100}},'tr-TR');
  assert.equal(unknown.known,false);assert.match(unknown.text,/neden uydurmayacağım/);
  assert.equal(characterStateAnswerForText('Neden omuzlarını silktin?',{state:'idle',lastSpeechGesture:{gesture:'shrug',responseKind:'uncertainty',ageMs:Infinity}},'tr-TR').known,false);
});

test('board follow-ups answer only from a successfully applied Academy action',()=>{
  const shape=academyBoardRecallAnswerForText('Az önce tahtaya ne çizdin?',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(shape.known,true);assert.equal(shape.text,'En son Academy tahtasına bir ok çizdim.');
  assert.equal(academyBoardRecallAnswerForText('Tahtada ne var?',{kind:'shape',value:'hexagon'},'tr-TR').text,'En son Academy tahtasına bir altıgen çizdim.');
  assert.deepEqual(academyBoardRecallAnswerForText('Tahtadaki şeklin adı ne?',{kind:'shape',value:'triangle'},'tr-TR'),{accepted:true,known:true,kind:'shape-identity',value:'triangle',text:'Bu doğrulanmış şekil bir üçgendir.'});
  assert.deepEqual(academyBoardRecallAnswerForText('Bu bir üçgen mi?',{kind:'shape',value:'triangle'},'tr-TR'),{accepted:true,known:true,kind:'shape-confirmation',value:true,requested:'triangle',actual:'triangle',text:'Evet, bu doğrulanmış şekil bir üçgen.'});
  const no=academyBoardRecallAnswerForText('Bu bir altıgen mi?',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(no.value,false);assert.equal(no.actual,'arrow');assert.match(no.text,/altıgen değil, ok/);
  assert.match(academyBoardRecallAnswerForText('Is this a circle?',{kind:'shape',value:'rectangle'},'en-US').text,/not a circle.*rectangle/);
  assert.match(academyBoardRecallAnswerForText('What is this shape called?',{kind:'shape',value:'circle'},'en-US').text,/a circle/);
  assert.equal(academyBoardRecallAnswerForText('Bu hangi şekil?',{kind:'text',value:'Pruva 090'},'tr-TR').known,false);
  assert.equal(academyBoardRecallAnswerForText('Bu bir üçgen mi?',{kind:'text',value:'Pruva 090'},'tr-TR').known,false);
  assert.equal(academyBoardRecallAnswerForText('Tahtadakini göster.',{kind:'shape',value:'arrow'},'tr-TR').text,'Tahtadaki doğrulanmış ok şeklini gösteriyorum.');
  assert.equal(academyBoardRecallAnswerForText('Tahtadaki oku göster.',{kind:'shape',value:'arrow'},'tr-TR').known,true);
  const mismatch=academyBoardRecallAnswerForText('Tahtadaki altıgeni göster.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(mismatch.known,false);assert.equal(mismatch.requested,'hexagon');assert.equal(mismatch.actual,'arrow');assert.match(mismatch.text,/doğrulanmış son şekil ok.*Altıgen varmış gibi göstermeyeceğim/);
  assert.match(academyBoardRecallAnswerForText('Show the hexagon on the board.',{kind:'shape',value:'triangle'},'en-US').text,/last verified shape is a triangle/);
  assert.match(academyBoardRecallAnswerForText('Show what is on the board.',{kind:'text',value:'Pruva 090'},'en-US').text,/showing the verified.*Pruva 090/);
  assert.match(academyBoardRecallAnswerForText('What is on the board?',{kind:'text',value:'Pruva 090'},'en-US').text,/Pruva 090/);
  const writing=academyBoardRecallAnswerForText('What did you last write on the board?',{kind:'text',value:'Pruva 090'},'en-US');assert.match(writing.text,/Pruva 090/);assert.equal(writing.kind,'text');
  const unknown=academyBoardRecallAnswerForText('Tahtaya en son ne yazdın?',null,'tr-TR');assert.equal(unknown.known,false);assert.match(unknown.text,/başarıyla uygulanmış/);
  assert.equal(academyBoardRecallAnswerForText('Tahtada ne var?',null,'tr-TR').known,false);
  assert.equal(academyBoardRecallAnswerForText('Tahtadakini göster.',null,'tr-TR').known,false);
  assert.equal(academyBoardRecallAnswerForText('Bugün ne öğreneceğiz?',{kind:'shape',value:'circle'}).reason,'NO_BOARD_RECALL_REQUEST');
  assert.equal(academyBoardRecallAnswerForText('Tahtaya en son ne çizdin?',{kind:'shape',value:'star'}).known,false);
});

test('board follow-ups repeat only a verified bounded Academy action',()=>{
  const shape=academyBoardRepeatRequestForText('Onu tekrar çiz.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(shape.known,true);assert.deepEqual(shape.action,{kind:'shape',value:'arrow'});
  const writing=academyBoardRepeatRequestForText('Write that again.',{kind:'text',value:'Pruva 090'},'en-US');assert.equal(writing.known,true);assert.deepEqual(writing.action,{kind:'text',value:'Pruva 090'});
  assert.equal(academyBoardRepeatRequestForText('Onu tekrar çiz.',null,'tr-TR').known,false);
  assert.equal(academyBoardRepeatRequestForText('Onu tekrar çiz.',{kind:'shape',value:'star'},'tr-TR').known,false);
  assert.equal(academyBoardRepeatRequestForText('Bugün ne öğreneceğiz?',{kind:'shape',value:'arrow'}).reason,'NO_BOARD_REPEAT_REQUEST');
});

test('board clearing is a narrow explicit action and ordinary deletion text is ignored',()=>{
  assert.deepEqual(academyBoardClearRequestForText('Tahtayı temizle.','tr-TR'),{accepted:true,action:'clear-board',text:'Academy tahtasını temizliyorum.'});
  assert.equal(academyBoardClearRequestForText('Clear the board.','en-US').accepted,true);
  assert.equal(academyBoardClearRequestForText('Dosyayı sil.','tr-TR').reason,'NO_BOARD_CLEAR_REQUEST');
  assert.equal(academyBoardClearRequestForText('Tahtadaki problemi açıkla.','tr-TR').reason,'NO_BOARD_CLEAR_REQUEST');
});

test('board resizing resolves only a verified shape into fixed safe sizes',()=>{
  assert.deepEqual(academyBoardResizeRequestForText('Bunu daha büyük çiz.',{kind:'shape',value:'arrow'},'tr-TR').action,{kind:'shape',value:'arrow',size:'large'});
  assert.deepEqual(academyBoardResizeRequestForText('Tahtadaki oku büyüt.',{kind:'shape',value:'arrow'},'tr-TR').action,{kind:'shape',value:'arrow',size:'large'});
  const mismatch=academyBoardResizeRequestForText('Altıgeni büyüt.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(mismatch.known,false);assert.equal(mismatch.actual,'arrow');assert.equal(mismatch.requested,'hexagon');assert.match(mismatch.text,/doğrulanmış şekil ok/);
  assert.match(academyBoardResizeRequestForText('Make the hexagon bigger.',{kind:'shape',value:'triangle'},'en-US').text,/verified shape is a triangle/);
  assert.equal(academyBoardResizeRequestForText('Draw it smaller.',{kind:'shape',value:'circle'},'en-US').action.size,'small');
  assert.equal(academyBoardResizeRequestForText('Bunu büyüt.',{kind:'text',value:'Pruva 090'},'tr-TR').known,false);
  assert.equal(academyBoardResizeRequestForText('Daha büyük bir hedefimiz var.',{kind:'shape',value:'arrow'}).reason,'NO_BOARD_RESIZE_REQUEST');
});

test('board size follow-ups answer only from the verified applied size',()=>{
  assert.deepEqual(academyBoardSizeRecallAnswerForText('Hangi boyutta çizdin?',{kind:'shape',value:'arrow',size:'large'},'tr-TR'),{accepted:true,known:true,size:'large',text:'Son şekli büyük boyutta çizdim.'});
  assert.match(academyBoardSizeRecallAnswerForText('What size did you draw?',{kind:'shape',value:'circle',size:'small'},'en-US').text,/small size/);
  assert.equal(academyBoardSizeRecallAnswerForText('Hangi boyutta çizdin?',{kind:'shape',value:'arrow'},'tr-TR').known,false);
  assert.equal(academyBoardSizeRecallAnswerForText('Bugün ne çizeceğiz?',{kind:'shape',value:'arrow',size:'large'}).reason,'NO_BOARD_SIZE_RECALL_REQUEST');
});

test('board shape explanation is grounded in the verified allowlisted shape',()=>{
  const arrow=academyBoardShapeExplanationForText('Bu şekli açıkla.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(arrow.known,true);assert.match(arrow.text,/yönü gösterir/);
  assert.equal(academyBoardShapeExplanationForText('Tahtadaki oku açıkla.',{kind:'shape',value:'arrow'},'tr-TR').known,true);
  const mismatch=academyBoardShapeExplanationForText('Tahtadaki altıgeni açıkla.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(mismatch.known,false);assert.equal(mismatch.actual,'arrow');assert.equal(mismatch.requested,'hexagon');assert.match(mismatch.text,/doğrulanmış şekil ok/);
  assert.match(academyBoardShapeExplanationForText('Explain the hexagon.',{kind:'shape',value:'triangle'},'en-US').text,/verified shape is a triangle/);
  assert.match(academyBoardShapeExplanationForText('Explain this shape.',{kind:'shape',value:'triangle'},'en-US').text,/three sides/);
  assert.equal(academyBoardShapeExplanationForText('Bu şekli açıkla.',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeExplanationForText('Bu şekli açıkla.',{kind:'shape',value:'star'},'tr-TR').known,false);
  assert.equal(academyBoardShapeExplanationForText('Bugün ne öğreneceğiz?',{kind:'shape',value:'arrow'}).reason,'NO_BOARD_EXPLANATION_REQUEST');
});

test('direct board property questions answer only from the verified visible shape',()=>{
  assert.deepEqual(academyBoardShapePropertyAnswerForText('Bu şeklin kaç kenarı var?',{kind:'shape',value:'hexagon'},'tr-TR'),{accepted:true,known:true,shape:'hexagon',property:'sides',value:6,text:'Tahtadaki doğrulanmış altıgenin 6 kenarı vardır.'});
  const mismatch=academyBoardShapePropertyAnswerForText('Bu altıgenin kaç kenarı var?',{kind:'shape',value:'triangle'},'tr-TR');assert.equal(mismatch.known,false);assert.equal(mismatch.requested,'hexagon');assert.equal(mismatch.actual,'triangle');assert.match(mismatch.text,/tahtadaki şekil üçgen/);
  assert.match(academyBoardShapePropertyAnswerForText('How many corners does this rectangle have?',{kind:'shape',value:'circle'},'en-US').text,/board shows a circle/);
  assert.deepEqual(academyBoardShapePropertyAnswerForText('Bu şeklin kaç köşesi var?',{kind:'shape',value:'circle'},'tr-TR'),{accepted:true,known:true,shape:'circle',property:'corners',value:0,text:'Tahtadaki doğrulanmış dairenin 0 köşesi vardır.'});
  assert.match(academyBoardShapePropertyAnswerForText('How many sides does this shape have?',{kind:'shape',value:'triangle'},'en-US').text,/verified triangle.*3 sides/);
  assert.equal(academyBoardShapePropertyAnswerForText('Bu şeklin kaç kenarı var?',null,'tr-TR').known,false);
  assert.equal(academyBoardShapePropertyAnswerForText('Bu şeklin kaç kenarı var?',{kind:'shape',value:'arrow'},'tr-TR').known,false);
  assert.equal(academyBoardShapePropertyAnswerForText('Bu şekli açıkla.',{kind:'shape',value:'hexagon'},'tr-TR').reason,'NO_BOARD_PROPERTY_REQUEST');
});

test('named board shapes resolve consistently across show, resize, explain and property paths',()=>{
  const triangle={kind:'shape',value:'triangle',size:'standard'};
  assert.equal(academyBoardRecallAnswerForText('Tahtadaki üçgeni göster.',triangle,'tr-TR').known,true);
  assert.deepEqual(academyBoardResizeRequestForText('Üçgeni büyüt.',triangle,'tr-TR').action,{kind:'shape',value:'triangle',size:'large'});
  assert.equal(academyBoardShapeExplanationForText('Tahtadaki üçgeni açıkla.',triangle,'tr-TR').shape,'triangle');
  assert.equal(academyBoardShapePropertyAnswerForText('Bu üçgenin kaç köşesi var?',triangle,'tr-TR').value,3);
  assert.equal(academyBoardRecallAnswerForText('Tahtadaki oku göster.',{kind:'shape',value:'arrow'},'tr-TR').known,true);
  assert.equal(academyBoardResizeRequestForText('Koordinat eksenlerini küçült.',{kind:'shape',value:'axes'},'tr-TR').action.value,'axes');
});

test('why after a direct board fact explains only the exact verified property',()=>{
  const hexagon=academyBoardShapePropertyReasonForText('Neden?',{shape:'hexagon',property:'sides',value:6},'tr-TR');
  assert.deepEqual(hexagon,{accepted:true,known:true,shape:'hexagon',property:'sides',value:6,text:'Çünkü altıgenin kapalı sınırı altı düz kenarın uç uca birleşmesiyle oluşur.'});
  assert.match(academyBoardShapePropertyReasonForText('Why?',{shape:'rectangle',property:'corners',value:4},'en-US').text,/four distinct right-angled corners/);
  assert.equal(academyBoardShapePropertyReasonForText('Neden?',null,'tr-TR').known,false);
  assert.equal(academyBoardShapePropertyReasonForText('Neden?',{shape:'hexagon',property:'sides',value:5},'tr-TR').known,false);
  assert.equal(academyBoardShapePropertyReasonForText('Yeni soru.',{shape:'hexagon',property:'sides',value:6},'tr-TR').reason,'NO_BOARD_PROPERTY_REASON_REQUEST');
});

test('board shape checks ask and assess only against a verified bounded answer key',()=>{
  const prompt=academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(prompt.known,true);assert.deepEqual(prompt.check,{shape:'arrow',expected:'direction'});
  assert.equal(academyBoardShapeCheckAnswerForText('Yönü gösterir.',prompt.check,'tr-TR').correct,true);
  const recovered=academyBoardShapeCheckAnswerForText('Yönü gösterir.',{...prompt.check,attempts:1},'tr-TR');assert.equal(recovered.correct,true);assert.equal(recovered.recovered,true);assert.match(recovered.text,/İkinci denemende cevabını düzelttin/);
  const wrong=academyBoardShapeCheckAnswerForText('Üç kenarı vardır.',prompt.check,'tr-TR');assert.equal(wrong.correct,false);assert.equal(wrong.retry,true);assert.match(wrong.text,/Doğru cevabı açıklamadan bir kez daha denemeni istiyorum/);assert.doesNotMatch(wrong.text,/yönü gösterir/);
  const exhausted=academyBoardShapeCheckAnswerForText('Hâlâ üç kenarı vardır.',{...prompt.check,attempts:1},'tr-TR');assert.equal(exhausted.correct,false);assert.equal(exhausted.retry,false);assert.equal(exhausted.completed,true);assert.match(exhausted.text,/Doğru bilgi: Okun uç kısmı yönü gösterir.*Soruyu burada kapatıyorum/);
  assert.equal(academyBoardShapeCheckAnswerForText('Geç.',prompt.check,'tr-TR').cancelled,true);
  assert.equal(academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',{kind:'shape',value:'arrow'},'tr-TR',3).reason,'INVALID_BOARD_CHECK_VARIANT');
});

test('hexagon teaching remains grounded across recall, resize, explanation and assessment',()=>{
  const shape={kind:'shape',value:'hexagon',size:'standard'};
  assert.equal(academyBoardRecallAnswerForText('Tahtaya en son ne çizdin?',shape,'tr-TR').text,'En son Academy tahtasına bir altıgen çizdim.');
  assert.deepEqual(academyBoardRepeatRequestForText('Onu tekrar çiz.',shape,'tr-TR').action,shape);
  assert.deepEqual(academyBoardResizeRequestForText('Bunu daha büyük çiz.',shape,'tr-TR').action,{kind:'shape',value:'hexagon',size:'large'});
  assert.match(academyBoardShapeExplanationForText('Bu şekli açıkla.',shape,'tr-TR').text,/altı düz kenarı ve altı köşesi/);
  const prompt=academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',shape,'tr-TR');
  assert.equal(prompt.known,true);assert.deepEqual(prompt.check,{shape:'hexagon',expected:'six'});assert.match(prompt.text,/Altıgenin kaç kenarı/);
  const wrong=academyBoardShapeCheckAnswerForText('Dört.',prompt.check,'tr-TR');assert.equal(wrong.correct,false);assert.match(wrong.text,/Doğru cevabı açıklamadan/);assert.doesNotMatch(wrong.text,/Altıgenin altı kenarı vardır/);
  const correct=academyBoardShapeCheckAnswerForText('Altı.',prompt.check,'tr-TR');assert.equal(correct.correct,true);
  const hint=academyBoardShapeCheckHintForText('İpucu ver.',{...prompt.check,question:prompt.text,attempts:0},'tr-TR');assert.equal(hint.known,true);assert.match(hint.text,/düz parçaları/);
  const revealed=academyBoardShapeCheckRevealForText('Doğru cevabı söyle.',prompt.check,'tr-TR');assert.match(revealed.text,/Altıgenin altı kenarı vardır/);
  const reason=academyBoardShapeCheckReasonForText('Neden?',{...prompt.check,reasonAvailable:true},'tr-TR');assert.match(reason.text,/altı düz kenarın uç uca birleşmesi/);
});

test('board question wording uses a non-repeating bounded random bag without changing the answer key',()=>{
  const director=createAcademyBoardQuestionDirector({entropy:()=>0}),action={kind:'shape',value:'arrow'};
  const prompts=Array.from({length:3},()=>director.ask('Bu şekille ilgili bana soru sor.',action,'tr-TR'));
  assert.equal(new Set(prompts.map(prompt=>prompt.text)).size,3);
  assert.ok(prompts.every(prompt=>prompt.check.expected==='direction'&&prompt.check.shape==='arrow'));
  const next=director.ask('Bu şekille ilgili bana soru sor.',action,'tr-TR');assert.notEqual(next.text,prompts.at(-1).text);
  assert.equal(createAcademyBoardQuestionDirector({entropy:()=>1}).ask('Bu şekille ilgili bana soru sor.',action,'tr-TR').reason,'INVALID_ENTROPY');
});

test('an open verified board question can be repeated without assessing or consuming an attempt',()=>{
  const check={shape:'arrow',expected:'direction',question:'Ok başı hangi bilgiyi gösterir?',attempts:0};
  const repeated=academyBoardShapeCheckRepeatForText('Soruyu tekrar eder misin?',check,'tr-TR');
  assert.equal(repeated.accepted,true);assert.equal(repeated.known,true);assert.equal(repeated.repeated,true);assert.match(repeated.text,/Ok başı hangi bilgiyi gösterir/);
  assert.equal(academyBoardShapeCheckRepeatForText('Soruyu tekrar et.',{...check,question:''},'tr-TR').known,false);
  assert.equal(academyBoardShapeCheckRepeatForText('Yönü gösterir.',check,'tr-TR').reason,'NO_BOARD_CHECK_REPEAT_REQUEST');
});

test('an open verified board question gives a bounded hint without revealing or assessing the answer',()=>{
  const check={shape:'arrow',expected:'direction',question:'Ok başı hangi bilgiyi gösterir?',attempts:0};
  const hint=academyBoardShapeCheckHintForText('Bir ipucu verir misin?',check,'tr-TR');
  assert.equal(hint.accepted,true);assert.equal(hint.known,true);assert.equal(hint.hint,true);assert.equal(hint.hintIndex,0);assert.equal(hint.shape,'arrow');assert.match(hint.text,/sivri uç kısmına/);assert.doesNotMatch(hint.text,/cevap|doğru|yönü gösterir/iu);
  const second=academyBoardShapeCheckHintForText('İpucu ver.',{...check,hintsUsed:1},'tr-TR');assert.equal(second.hint,true);assert.equal(second.hintIndex,1);assert.match(second.text,/gövdesinin hangi tarafa/);
  const exhausted=academyBoardShapeCheckHintForText('İpucu ver.',{...check,hintsUsed:2},'tr-TR');assert.equal(exhausted.hint,false);assert.equal(exhausted.exhausted,true);assert.match(exhausted.text,/cevaplayabilir veya soruyu geçebilirsin/);
  assert.equal(academyBoardShapeCheckHintForText('İpucu ver.',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeCheckHintForText('Yönü gösterir.',check,'tr-TR').reason,'NO_BOARD_CHECK_HINT_REQUEST');
});

test('an open verified board question reveals only its fixed answer and closes explicitly',()=>{
  const check={shape:'arrow',expected:'direction',question:'Ok başı hangi bilgiyi gösterir?',attempts:0};
  const revealed=academyBoardShapeCheckRevealForText('Doğru cevabı söyle.',check,'tr-TR');
  assert.equal(revealed.accepted,true);assert.equal(revealed.known,true);assert.equal(revealed.revealed,true);assert.equal(revealed.completed,true);assert.match(revealed.text,/Doğru cevap: Okun uç kısmı yönü gösterir.*Soruyu burada kapatıyorum/);
  assert.equal(academyBoardShapeCheckRevealForText('Doğru cevabı söyle.',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeCheckRevealForText('Yönü gösterir.',check,'tr-TR').reason,'NO_BOARD_CHECK_REVEAL_REQUEST');
});

test('a why follow-up explains only a verified current or previous board answer',()=>{
  const check={shape:'arrow',expected:'direction',reasonAvailable:true};
  const reasoned=academyBoardShapeCheckReasonForText('Neden?',check,'tr-TR');
  assert.equal(reasoned.accepted,true);assert.equal(reasoned.known,true);assert.equal(reasoned.reasoned,true);assert.match(reasoned.text,/sivri uç kısmı.*hangi tarafa yöneldiğini/);
  const early=academyBoardShapeCheckReasonForText('Neden?',{shape:'arrow',expected:'direction'},'tr-TR');assert.equal(early.accepted,true);assert.equal(early.known,false);assert.equal(early.pending,true);assert.doesNotMatch(early.text,/sivri uç kısmı|yöneldiğini/);
  assert.equal(academyBoardShapeCheckReasonForText('Neden?',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeCheckReasonForText('Yeni bir soru sor.',check,'tr-TR').reason,'NO_BOARD_CHECK_REASON_REQUEST');
});

test('relative gesture commands resolve only against a verified previous action',()=>{
  const other=gestureRequestForText('Şimdi öbür elini göster.',{lastAction:'show-right-hand'});
  assert.equal(other.supported,true);assert.equal(other.contextual,true);assert.equal(other.action,'raise-left-hand');
  const repeated=gestureRequestForText('Aynı hareketi tekrar yap.',{lastAction:'look-left'});
  assert.equal(repeated.action,'look-left');assert.equal(repeated.cue.gesture,'look-left');
  const ambiguous=gestureRequestForText('Öbür elini göster.',{lastAction:'show-palm'});
  assert.equal(ambiguous.supported,false);assert.equal(ambiguous.reason,'NO_VERIFIED_GESTURE_REFERENCE');
  assert.equal(gestureRequestForText('Do it again.').supported,false);
  const otherPalm=gestureRequestForText('Peki öbür avucunda bir şey var mı?',{lastAction:'raise-left-hand'});
  assert.equal(otherPalm.supported,true);assert.equal(otherPalm.contextual,true);assert.equal(otherPalm.action,'show-right-hand');assert.equal(otherPalm.palmSide,'right');assert.equal(otherPalm.cue.gesture,'show-palm');
  assert.match(gestureAcknowledgementForRequest(otherPalm,'tr-TR').text,/^Sağ avucumu açıp gösteriyorum/);
  assert.equal(gestureRequestForText('Peki öbür avucunda ne var?',{lastAction:'look-left'}).supported,false);
});

test('performed gesture history is bounded, verified and answers ordered follow-ups',()=>{
  let history=[];
  for(const action of ['smile','show-right-hand','raise-left-hand','look-left','nod']){
    const recorded=recordVerifiedGesture(history,action,{limit:4});assert.equal(recorded.accepted,true);history=[...recorded.history];
  }
  assert.deepEqual(history,['show-right-hand','raise-left-hand','look-left','nod']);
  const answer=gestureHistoryAnswerForText('Önce ne yaptın, sonra ne yaptın?',history,'tr-TR');
  assert.equal(answer.known,true);assert.deepEqual(answer.actions,['look-left','nod']);assert.match(answer.text,/Önce başımı sola çevirdim; ardından başımı eğdim\./);
  assert.equal(gestureHistoryAnswerForText('Son iki hareketin neydi?',[],'tr-TR').known,false);
  assert.equal(recordVerifiedGesture(history,'teleport').reason,'UNVERIFIED_GESTURE_ACTION');
  assert.equal(recordVerifiedGesture(history,'smile',{limit:99}).reason,'INVALID_GESTURE_HISTORY');
});

test('the last two verified supported gestures can be replayed in order without invention',()=>{
  const replay=gestureHistoryReplayForText('Son iki hareketini tekrar yap.',['wave','nod'],'tr-TR');
  assert.equal(replay.known,true);assert.deepEqual(replay.actions,['wave','nod']);assert.match(replay.text,/aynı sırayla/);
  const sequence=gestureSequenceForRequest(replay.action,{actions:replay.actions});
  assert.equal(sequence.accepted,true);assert.deepEqual(sequence.cues.filter(cue=>cue.actionStart).map(cue=>cue.actionStart),['wave','nod']);assert.ok(sequence.duration<=4000);
  assert.equal(gestureHistoryReplayForText('Son iki hareketini tekrar yap.',['smile','nod'],'tr-TR').known,false);
  assert.equal(gestureHistoryReplayForText('Son iki hareketini tekrar yap.',['wave'],'tr-TR').known,false);
  assert.deepEqual(gestureHistoryReplayForText('Aynı ikisini bir daha yap.',['show-right-hand','raise-left-hand'],'tr-TR').actions,['show-right-hand','raise-left-hand']);
  assert.equal(gestureHistoryReplayForText('Bugün ne yapacağız?',['wave','nod'],'tr-TR').reason,'NO_GESTURE_HISTORY_REPLAY_REQUEST');
  assert.equal(gestureHistoryReplayForText('Repeat your last two movements.',['shake-head','point-board'],'en-US').known,true);
  assert.equal(gestureHistoryReplayForText('Repeat the same two.',['wave','nod'],'en-US').known,true);
});

test('explicit stop commands are narrow, deterministic and do not misread ordinary uses of dur',()=>{
  assert.deepEqual(gestureStopRequestForText('Sinbad, elini indir.','tr-TR'),{accepted:true,action:'stop-motion',text:'Hareketi durdurdum ve nötr poza döndüm.'});
  assert.match(gestureStopRequestForText('Stop moving.','en-US').text,/neutral pose/);
  assert.equal(gestureStopRequestForText('Bu ders ne kadar sürer?').reason,'NO_GESTURE_STOP_REQUEST');
  assert.equal(gestureStopRequestForText(' ').reason,'INVALID_STOP_TEXT');
});

test('reduced-motion commands are explicit, bilingual and do not capture ordinary animation questions',()=>{
  assert.deepEqual(reducedMotionCommandForText('Hareketleri azalt.','tr-TR'),{accepted:true,enabled:true,text:'Hareket azaltma tercihini açtım; uzun ve tekrarlı animasyonları oynatmayacağım.'});
  assert.equal(reducedMotionCommandForText('Normal hareketlere dön.','tr-TR').enabled,false);
  assert.equal(reducedMotionCommandForText('Enable reduced motion.','en-US').enabled,true);
  assert.equal(reducedMotionCommandForText('Turn off reduced motion.','en-US').enabled,false);
  assert.equal(reducedMotionCommandForText('Animasyon nasıl çalışıyor?','tr-TR').reason,'NO_REDUCED_MOTION_COMMAND');
});

test('object and board gestures receive finite interruptible gaze transitions',()=>{
  const palm=gazeTransitionForCue({gesture:'show-palm',gaze:'audience'});
  assert.equal(palm.accepted,true);assert.deepEqual(palm.cues.map(cue=>cue.gaze),['palm','audience']);assert.equal(palm.duration,520);
  const board=gazeTransitionForCue({gesture:'point-board',gaze:'board'});
  assert.deepEqual(board.cues.map(cue=>cue.gaze),['board','audience','board']);assert.ok(board.duration<=1600);
  const reduced=gazeTransitionForCue({gesture:'show-palm',gaze:'audience'},{reducedMotion:true});
  assert.deepEqual(reduced.cues.map(cue=>cue.gaze),['audience']);assert.equal(Object.isFrozen(reduced.cues),true);
  assert.deepEqual(gazeTransitionForCue({gesture:'raise-left',gaze:'audience'}).cues.map(cue=>cue.gaze),['left-palm','audience']);
  const both=gazeTransitionForCue({gesture:'show-both-hands',gaze:'audience'});assert.deepEqual(both.cues.map(cue=>cue.gaze),['left-palm','palm','audience']);assert.equal(both.duration,720);
  assert.deepEqual(gazeTransitionForCue({gesture:'show-both-hands',gaze:'audience'},{reducedMotion:true}).cues.map(cue=>cue.gaze),['audience']);
  assert.equal(gazeTransitionForCue(null).reason,'INVALID_GAZE_CUE');
});

test('live speech gestures follow emphasis and variable bounded gaps without immediate repetition',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0});
  const opening=director.select({cadence:'opening',responseKind:'conversation',gesture:'open-hand',gaze:'audience',emotion:'warm'});
  const word1=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  const word2=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  const word3=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  assert.equal(opening.change,true);assert.equal(opening.cue.performancePhase,'accent');assert.equal(word1.change,false);assert.equal(word1.cue.performancePhase,'hold');assert.equal(word2.change,true);assert.equal(word2.cue.performancePhase,'settle');assert.equal(word2.cue.gesture,'rest');assert.equal(word3.change,true);
  assert.notEqual(opening.cue.variantId,word3.cue.variantId);
  const caution=director.select({cadence:'pause',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned'});
  assert.equal(caution.change,true);assert.equal(['hold','open-hand','nod'].includes(caution.cue.gesture),true);assert.notEqual(caution.cue.emotion,'joyful');
  director.reset();assert.equal(director.select({cadence:'opening',responseKind:'conversation'}).change,true);
  assert.equal(createSpeechGestureDirector({entropy:()=>1}).select({cadence:'word',responseKind:'conversation'}).reason,'INVALID_ENTROPY');
  assert.equal(director.select(null).reason,'INVALID_SPEECH_CUE');
});

test('speech gesture lifecycle settles caution into a guarded hold instead of a relaxed pose',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0});
  director.select({cadence:'opening',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned',energy:.32});
  const held=director.select({cadence:'word',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned',energy:.32});
  const settled=director.select({cadence:'word',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned',energy:.32});
  assert.equal(held.change,false);assert.equal(settled.change,true);assert.equal(settled.cue.gesture,'hold');assert.equal(settled.cue.emotion,'concerned');assert.equal(settled.cue.performancePhase,'settle');
});

test('long speech answers settle after two expansive secondary gestures',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0}),cue={cadence:'emphasis',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm',energy:.4};
  const selected=Array.from({length:5},()=>director.select(cue));
  assert.equal(selected.filter(item=>item.cue.gestureFamily==='expansive').length,2);
  assert.equal(selected.at(-1).cue.gesture,'hold');
  assert.equal(selected.at(-1).cue.motionBudget,'settled');
  assert.equal(selected.at(-1).cue.motionProfile,'gentle');
  director.reset();assert.equal(director.select(cue).cue.gesture,'open-hand');
});

test('a new speech turn clears per-answer budgets but preserves bounded body-language memory',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0}),cue={cadence:'opening',responseKind:'conversation',gesture:'open-hand',gaze:'audience',emotion:'warm'};
  const first=director.select(cue).cue;
  director.beginTurn();
  const second=director.select(cue).cue;
  assert.equal(first.gestureFamily,'expansive');assert.notEqual(second.gestureFamily,'expansive');
  director.reset();assert.equal(director.select(cue).cue.gestureFamily,'expansive');
});

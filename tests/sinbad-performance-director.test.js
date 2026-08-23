const test=require('node:test');
const assert=require('node:assert/strict');
const {PERFORMANCES,CUE_SEQUENCES,LISTENING_MEANING_POOLS,THINKING_STAGE_CUES,IMPROVISATION_POOLS,MOTION_PROFILES,IDLE_MICRO_CUES,cueAt,speechModeForDecision,speechCueForBoundary,speechTransitionForKinds,listeningCueForActivity,listeningPauseForPace,listeningCueForPace,listeningCueForText,thinkingCueForStage,responseCueForText,textPresentationCues,gestureRequestForText,gestureAcknowledgementForRequest,groundResponseWithGesture,gestureRecallAnswerForText,academyBoardRecallAnswerForText,academyBoardRepeatRequestForText,academyBoardClearRequestForText,academyBoardResizeRequestForText,academyBoardSizeRecallAnswerForText,academyBoardShapeExplanationForText,academyBoardShapeCheckForText,academyBoardShapeCheckAnswerForText,recordVerifiedGesture,gestureHistoryAnswerForText,gestureStopRequestForText,gestureSequenceForRequest,gazeTransitionForCue,createListeningReactionDirector,createIdleBehaviorDirector,createImprovisationDirector,createSpeechGestureDirector,createPerformanceDirector}=require('../sinbad-performance-director.js');

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

test('improvisation is injectable for tests and fails closed for invalid context or entropy',()=>{
  const high=createImprovisationDirector({entropy:()=>.999999}).choose('conversation');
  assert.equal(high.cue.variantId,'conversation-rest');
  assert.equal(createImprovisationDirector({entropy:()=>1}).choose('conversation').reason,'INVALID_ENTROPY');
  assert.equal(createImprovisationDirector().choose('unsafe-dance').reason,'UNKNOWN_RESPONSE_KIND');
});

test('explicit gesture requests override improvisation only when a real supported pose exists',()=>{
  const palm=gestureRequestForText('Sinbad avucunun içinde bir şey mi var? Avucunu açar mısın?');
  assert.equal(palm.supported,true);assert.equal(palm.action,'show-palm');assert.equal(palm.cue.gesture,'show-palm');
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
  const listening=gestureRequestForText('Beni dinliyor musun?');
  assert.equal(listening.action,'show-listening');assert.equal(listening.cue.gesture,'listen-lean');
  assert.equal(gestureRequestForText('Sağ elini göster.').action,'show-right-hand');
  assert.equal(gestureRequestForText('Sol elini kaldır.').cue.gesture,'raise-left');
  assert.equal(gestureRequestForText('İki elini aynı anda göster.').action,'show-both-hands');
  assert.equal(gestureRequestForText('Sinbad bana el sallar mısın?').action,'wave');
  assert.equal(gestureRequestForText('Başını sola çevir.').cue.gesture,'look-left');
  assert.equal(gestureRequestForText('Başını sağa döndür.').cue.gesture,'look-right');
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
  const left=gestureSequenceForRequest('raise-left-hand');assert.deepEqual(left.cues.map(cue=>cue.gaze),['audience','left-palm','audience']);
  const both=gestureSequenceForRequest('show-both-hands');assert.deepEqual(both.cues.map(cue=>cue.gesture),['rest','open-hand','show-both-hands','rest']);assert.ok(both.duration<=1400);
  const board=gestureSequenceForRequest('point-board');assert.equal(board.cues[1].gaze,'board');assert.ok(board.duration<=1200);
  const wave=gestureSequenceForRequest('wave');assert.deepEqual(wave.cues.map(cue=>cue.gesture),['open-hand','wave-right','wave-right-away','wave-right','wave-right-away','open-hand']);assert.ok(wave.duration<=1800);
  const laugh=gestureSequenceForRequest('laugh');assert.deepEqual(laugh.cues.map(cue=>cue.gesture),['rest','laugh','nod','laugh','rest']);assert.ok(laugh.duration<=1500);
  const no=gestureSequenceForRequest('shake-head');assert.deepEqual(no.cues.map(cue=>cue.gesture),['rest','shake-head-left','shake-head-right','shake-head-left','rest']);assert.ok(no.duration<=1800);
  const yes=gestureSequenceForRequest('nod');assert.deepEqual(yes.cues.map(cue=>cue.gesture),['rest','nod','nod-up','nod','rest']);assert.ok(yes.duration<=1400);
  assert.equal(gestureSequenceForRequest('smile').reason,'NO_GESTURE_SEQUENCE');
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
  const writing=gestureRequestForText('Tahtaya bir altıgen çiz.');
  assert.equal(writing.accepted,true);assert.equal(writing.supported,false);assert.equal(writing.reason,'GESTURE_NOT_IMPLEMENTED');
  const grounded=groundResponseWithGesture('İstersen konuyu açıklayabilirim.',writing,'tr-TR');
  assert.equal(grounded.grounded,true);assert.equal(grounded.supported,false);assert.match(grounded.text,/^Bu hareketi henüz güvenilir biçimde yapamıyorum\./);
  assert.equal(gestureAcknowledgementForRequest({accepted:true,supported:true,action:'teleport'}).reason,'UNMAPPED_GESTURE_ACTION');
  assert.equal(groundResponseWithGesture('',writing).reason,'INVALID_RESPONSE_TEXT');
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

test('board follow-ups answer only from a successfully applied Academy action',()=>{
  const shape=academyBoardRecallAnswerForText('Az önce tahtaya ne çizdin?',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(shape.known,true);assert.equal(shape.text,'En son Academy tahtasına bir ok çizdim.');
  const writing=academyBoardRecallAnswerForText('What did you last write on the board?',{kind:'text',value:'Pruva 090'},'en-US');assert.match(writing.text,/Pruva 090/);assert.equal(writing.kind,'text');
  const unknown=academyBoardRecallAnswerForText('Tahtaya en son ne yazdın?',null,'tr-TR');assert.equal(unknown.known,false);assert.match(unknown.text,/başarıyla uygulanmış/);
  assert.equal(academyBoardRecallAnswerForText('Bugün ne öğreneceğiz?',{kind:'shape',value:'circle'}).reason,'NO_BOARD_RECALL_REQUEST');
  assert.equal(academyBoardRecallAnswerForText('Tahtaya en son ne çizdin?',{kind:'shape',value:'hexagon'}).known,false);
});

test('board follow-ups repeat only a verified bounded Academy action',()=>{
  const shape=academyBoardRepeatRequestForText('Onu tekrar çiz.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(shape.known,true);assert.deepEqual(shape.action,{kind:'shape',value:'arrow'});
  const writing=academyBoardRepeatRequestForText('Write that again.',{kind:'text',value:'Pruva 090'},'en-US');assert.equal(writing.known,true);assert.deepEqual(writing.action,{kind:'text',value:'Pruva 090'});
  assert.equal(academyBoardRepeatRequestForText('Onu tekrar çiz.',null,'tr-TR').known,false);
  assert.equal(academyBoardRepeatRequestForText('Onu tekrar çiz.',{kind:'shape',value:'hexagon'},'tr-TR').known,false);
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
  assert.match(academyBoardShapeExplanationForText('Explain this shape.',{kind:'shape',value:'triangle'},'en-US').text,/three sides/);
  assert.equal(academyBoardShapeExplanationForText('Bu şekli açıkla.',null,'tr-TR').known,false);
  assert.equal(academyBoardShapeExplanationForText('Bu şekli açıkla.',{kind:'shape',value:'hexagon'},'tr-TR').known,false);
  assert.equal(academyBoardShapeExplanationForText('Bugün ne öğreneceğiz?',{kind:'shape',value:'arrow'}).reason,'NO_BOARD_EXPLANATION_REQUEST');
});

test('board shape checks ask and assess only against a verified bounded answer key',()=>{
  const prompt=academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',{kind:'shape',value:'arrow'},'tr-TR');assert.equal(prompt.known,true);assert.deepEqual(prompt.check,{shape:'arrow',expected:'direction'});
  assert.equal(academyBoardShapeCheckAnswerForText('Yönü gösterir.',prompt.check,'tr-TR').correct,true);
  const wrong=academyBoardShapeCheckAnswerForText('Üç kenarı vardır.',prompt.check,'tr-TR');assert.equal(wrong.correct,false);assert.equal(wrong.retry,true);assert.match(wrong.text,/Okun uç kısmı yönü gösterir.*Bir kez daha deneyebilirsin/);
  const exhausted=academyBoardShapeCheckAnswerForText('Hâlâ üç kenarı vardır.',{...prompt.check,attempts:1},'tr-TR');assert.equal(exhausted.correct,false);assert.equal(exhausted.retry,false);assert.equal(exhausted.completed,true);assert.match(exhausted.text,/Doğru bilgi: Okun uç kısmı yönü gösterir.*Soruyu burada kapatıyorum/);
  assert.equal(academyBoardShapeCheckAnswerForText('Geç.',prompt.check,'tr-TR').cancelled,true);
  assert.equal(academyBoardShapeCheckForText('Bu şekille ilgili bana soru sor.',null,'tr-TR').known,false);
});

test('relative gesture commands resolve only against a verified previous action',()=>{
  const other=gestureRequestForText('Şimdi öbür elini göster.',{lastAction:'show-right-hand'});
  assert.equal(other.supported,true);assert.equal(other.contextual,true);assert.equal(other.action,'raise-left-hand');
  const repeated=gestureRequestForText('Aynı hareketi tekrar yap.',{lastAction:'look-left'});
  assert.equal(repeated.action,'look-left');assert.equal(repeated.cue.gesture,'look-left');
  const ambiguous=gestureRequestForText('Öbür elini göster.',{lastAction:'show-palm'});
  assert.equal(ambiguous.supported,false);assert.equal(ambiguous.reason,'NO_VERIFIED_GESTURE_REFERENCE');
  assert.equal(gestureRequestForText('Do it again.').supported,false);
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

test('explicit stop commands are narrow, deterministic and do not misread ordinary uses of dur',()=>{
  assert.deepEqual(gestureStopRequestForText('Sinbad, elini indir.','tr-TR'),{accepted:true,action:'stop-motion',text:'Hareketi durdurdum ve nötr poza döndüm.'});
  assert.match(gestureStopRequestForText('Stop moving.','en-US').text,/neutral pose/);
  assert.equal(gestureStopRequestForText('Bu ders ne kadar sürer?').reason,'NO_GESTURE_STOP_REQUEST');
  assert.equal(gestureStopRequestForText(' ').reason,'INVALID_STOP_TEXT');
});

test('object and board gestures receive finite interruptible gaze transitions',()=>{
  const palm=gazeTransitionForCue({gesture:'show-palm',gaze:'audience'});
  assert.equal(palm.accepted,true);assert.deepEqual(palm.cues.map(cue=>cue.gaze),['palm','audience']);assert.equal(palm.duration,520);
  const board=gazeTransitionForCue({gesture:'point-board',gaze:'board'});
  assert.deepEqual(board.cues.map(cue=>cue.gaze),['board','audience','board']);assert.ok(board.duration<=1600);
  const reduced=gazeTransitionForCue({gesture:'show-palm',gaze:'audience'},{reducedMotion:true});
  assert.deepEqual(reduced.cues.map(cue=>cue.gaze),['audience']);assert.equal(Object.isFrozen(reduced.cues),true);
  assert.deepEqual(gazeTransitionForCue({gesture:'raise-left',gaze:'audience'}).cues.map(cue=>cue.gaze),['left-palm','audience']);
  assert.equal(gazeTransitionForCue(null).reason,'INVALID_GAZE_CUE');
});

test('live speech gestures follow emphasis and variable bounded gaps without immediate repetition',()=>{
  const director=createSpeechGestureDirector({entropy:()=>0});
  const opening=director.select({cadence:'opening',responseKind:'conversation',gesture:'open-hand',gaze:'audience',emotion:'warm'});
  const word1=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  const word2=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  const word3=director.select({cadence:'word',responseKind:'conversation',gesture:'explain',gaze:'audience',emotion:'warm'});
  assert.equal(opening.change,true);assert.equal(word1.change,false);assert.equal(word2.change,false);assert.equal(word3.change,true);
  assert.notEqual(opening.cue.variantId,word3.cue.variantId);
  const caution=director.select({cadence:'pause',responseKind:'caution',gesture:'hold',gaze:'audience',emotion:'concerned'});
  assert.equal(caution.change,true);assert.equal(['hold','open-hand','nod'].includes(caution.cue.gesture),true);assert.notEqual(caution.cue.emotion,'joyful');
  director.reset();assert.equal(director.select({cadence:'opening',responseKind:'conversation'}).change,true);
  assert.equal(createSpeechGestureDirector({entropy:()=>1}).select({cadence:'word',responseKind:'conversation'}).reason,'INVALID_ENTROPY');
  assert.equal(director.select(null).reason,'INVALID_SPEECH_CUE');
});

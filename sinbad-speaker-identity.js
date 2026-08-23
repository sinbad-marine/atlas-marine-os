'use strict';
(function(root){
  const DB='sinbad-speaker-identity-v1',STORE='voiceprints',MIN_SAMPLES=3,MATCH_THRESHOLD=.84;
  let stream=null,context=null,analyser=null,timer=null,recent=[],active=null;
  const clean=value=>String(value||'').trim().slice(0,80);
  const rms=data=>Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/Math.max(1,data.length));
  function vector(data){
    let crossings=0,abs=0,diff=0,peak=0;
    for(let i=1;i<data.length;i++){const value=Math.abs(data[i]);abs+=value;peak=Math.max(peak,value);diff+=Math.abs(data[i]-data[i-1]);if((data[i-1]<0)!==(data[i]<0))crossings++}
    const energy=rms(data),zcr=crossings/Math.max(1,data.length-1),meanAbs=abs/Math.max(1,data.length-1),roughness=diff/Math.max(1,data.length-1);
    return [energy,zcr,meanAbs,roughness,peak].map(value=>Number(value.toFixed(6)));
  }
  const average=vectors=>vectors[0].map((_,i)=>vectors.reduce((sum,v)=>sum+v[i],0)/vectors.length);
  function similarity(a,b){if(!a?.length||a.length!==b?.length)return 0;const scale=[.12,.18,.12,.22,.8];const distance=Math.sqrt(a.reduce((sum,value,i)=>sum+Math.pow((value-b[i])/scale[i],2),0)/a.length);return Math.max(0,Math.min(1,1-distance/1.35))}
  function openDb(){return new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(new Error('Bu tarayıcı yerel ses kimliği deposunu desteklemiyor.'));const request=root.indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
  async function all(){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE).objectStore(STORE).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)})}
  async function put(record){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readwrite').objectStore(STORE).put(record);request.onsuccess=()=>resolve(record);request.onerror=()=>reject(request.error)})}
  async function remove(id){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)})}
  async function ensureMonitor(){
    if(analyser)return true;const Audio=root.AudioContext||root.webkitAudioContext;if(!root.navigator?.mediaDevices?.getUserMedia||!Audio)return false;
    stream=await root.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});context=new Audio();analyser=context.createAnalyser();analyser.fftSize=2048;context.createMediaStreamSource(stream).connect(analyser);const data=new Float32Array(analyser.fftSize);
    timer=setInterval(()=>{analyser.getFloatTimeDomainData(data);const item=vector(data);if(item[0]>.008){recent.push(item);recent=recent.slice(-50)}},80);return true;
  }
  async function monitorIfConsented(){const profiles=await all();if(!profiles.some(item=>item.consent&&item.voiceprint))return false;return ensureMonitor()}
  function stopMonitor(){if(timer)clearInterval(timer);timer=null;stream?.getTracks().forEach(track=>track.stop());stream=null;context?.close?.();context=null;analyser=null;recent=[]}
  async function captureSample(duration=2200){await ensureMonitor();recent=[];await new Promise(resolve=>setTimeout(resolve,duration));if(recent.length<5)throw new Error('Ses örneği yeterince net değil. Sessiz bir ortamda tekrar deneyin.');return average(recent)}
  async function enroll({id,name,title,consent}){if(!consent)throw new Error('Açık rıza verilmeden ses kimliği oluşturulamaz.');const sample=await captureSample();const existing=(await all()).find(item=>item.id===id),samples=[...(existing?.samples||[]),sample].slice(-MIN_SAMPLES);return put({id:clean(id),name:clean(name),title:clean(title),consent:true,samples,voiceprint:samples.length>=MIN_SAMPLES?average(samples):null,updatedAt:new Date().toISOString()})}
  async function identifyRecent(){const probe=recent.length>=5?average(recent.slice(-30)):null;if(!probe)return {matched:false,confidence:0};const profiles=(await all()).filter(item=>item.consent&&item.voiceprint);const ranked=profiles.map(profile=>({profile,confidence:similarity(probe,profile.voiceprint)})).sort((a,b)=>b.confidence-a.confidence),best=ranked[0];if(!best||best.confidence<MATCH_THRESHOLD){active=null;return {matched:false,confidence:best?.confidence||0}}active=best.profile;return {matched:true,confidence:best.confidence,profile:best.profile}}
  function address(profile=active){if(!profile)return '';const title=clean(profile.title),name=clean(profile.name);return title&&title.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')?name:clean([title,name].filter(Boolean).join(' '))}
  root.SinbadSpeakerIdentity={MIN_SAMPLES,MATCH_THRESHOLD,all,remove,enroll,monitorIfConsented,stopMonitor,identifyRecent,address,get active(){return active},setActive(profile){active=profile||null},_test:{vector,average,similarity}};
})(window);

'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');

const source=fs.readFileSync('academy-professor-handsfree.js','utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function createHarness(){
  const listeners=new Map(),status={textContent:''},input={value:''};let submits=0;
  const toggle={disabled:false,attrs:{},textContent:'',setAttribute(name,value){this.attrs[name]=value},addEventListener(type,handler){listeners.set(`toggle:${type}`,handler)},click(){listeners.get('toggle:click')?.()}};
  const stage={dataset:{state:'idle'}},stop={click(){}};
  const form={requestSubmit(){submits+=1}};
  const classroom={readyState:'loading',getElementById(id){return {academyQuestion:input,academyChatForm:form,academyInstructorStage:stage,academyStopVoice:stop}[id]||null}};
  const frame={contentDocument:classroom,contentWindow:{speechSynthesis:{speaking:false,cancel(){}}},addEventListener(type,handler){listeners.set(`frame:${type}`,handler)}};
  class MockRecognition{
    constructor(){MockRecognition.instance=this;this.started=false}
    start(){this.started=true;this.onstart?.()}
    stop(){this.started=false}
    abort(){this.started=false}
    emit(text,isFinal=true){const result={[0]:{transcript:text},isFinal};this.onresult?.({resultIndex:0,results:[result]})}
    end(){this.started=false;this.onend?.()}
  }
  const context={console,document:{getElementById(id){return {phaseOneClassroom:frame,toggleHandsFree:toggle,handsfreeStatus:status}[id]||null}},SpeechRecognition:MockRecognition,webkitSpeechRecognition:null,MutationObserver:class{},clearTimeout,setTimeout(fn,ms){const handle=setTimeout(fn,ms);handle.unref?.();return handle},window:null};
  context.window=context;context.addEventListener=(type,handler)=>listeners.set(`window:${type}`,handler);vm.createContext(context);vm.runInContext(source,context);
  return {toggle,status,input,recognition:MockRecognition.instance,get submits(){return submits}};
}

test('ambient speech stays local and is never submitted while Sinbad sleeps',async()=>{
  const h=createHarness();h.toggle.click();await delay(75);
  h.recognition.emit('Akşam ne yemek yapalım');h.recognition.end();await delay(20);
  assert.equal(h.submits,0);assert.match(h.status.textContent,/Uyku modundayım/);
});

test('Captain Sinbad plus a question submits only the question after speech ends',async()=>{
  const h=createHarness();h.toggle.click();await delay(75);
  h.recognition.emit('Kaptan Sinbad gelgit nedir');
  assert.equal(h.submits,0,'must not submit while the user is still speaking');
  h.recognition.end();
  assert.equal(h.submits,1);assert.equal(h.input.value,'gelgit nedir');
});

test('wake phrase alone arms the following utterance without submitting it',async()=>{
  const h=createHarness();h.toggle.click();await delay(75);
  h.recognition.emit('Kaptan Sinbad');h.recognition.end();
  assert.equal(h.submits,0);await delay(100);
  h.recognition.emit('COLREG kural on üç nedir');h.recognition.end();
  assert.equal(h.submits,1);assert.equal(h.input.value,'COLREG kural on üç nedir');
});

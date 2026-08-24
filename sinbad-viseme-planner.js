(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadVisemePlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VISEME_VERSION='sinbad-viseme-planner/1';
  const MAX_TOKEN_LENGTH=64;
  const LETTER=/\p{L}/u;
  const CLOSED=new Set([...'mbp']);
  const ROUND=new Set([...'oöuüw']);
  const WIDE=new Set([...'aeıi']);

  function frameForCharacter(character){
    if(typeof character!=='string'||!character)return 'open';
    const value=character.normalize('NFC').toLocaleLowerCase('tr-TR')[0];
    if(CLOSED.has(value))return 'closed';
    if(ROUND.has(value))return 'round';
    if(WIDE.has(value))return 'wide';
    return 'open';
  }

  function sequenceForToken(token){
    if(typeof token!=='string')return Object.freeze({accepted:false,reason:'INVALID_TOKEN'});
    const normalized=token.normalize('NFC').toLocaleLowerCase('tr-TR');
    const letters=[...normalized].filter(character=>LETTER.test(character));
    if(!letters.length)return Object.freeze({accepted:false,reason:'EMPTY_TOKEN'});
    if(letters.length>MAX_TOKEN_LENGTH)return Object.freeze({accepted:false,reason:'TOKEN_TOO_LONG'});
    const frames=[];
    for(const character of letters){
      const frame=frameForCharacter(character);
      if(frames.at(-1)!==frame)frames.push(frame);
    }
    return Object.freeze({accepted:true,version:VISEME_VERSION,token:letters.join(''),frames:Object.freeze(frames)});
  }

  function tokenAt(text,charIndex){
    if(typeof text!=='string'||!Number.isInteger(charIndex)||charIndex<0||charIndex>text.length)return '';
    const characters=[...text];
    // SpeechSynthesis boundary offsets use UTF-16 code units. Convert that
    // offset before scanning code points so an emoji/non-BMP character before
    // the word cannot shift the selected token.
    let cursor=Math.min([...text.slice(0,charIndex)].length,characters.length-1);
    while(cursor<characters.length&&!LETTER.test(characters[cursor]))cursor++;
    if(cursor>=characters.length)return '';
    let start=cursor,end=cursor+1;
    while(start>0&&LETTER.test(characters[start-1]))start--;
    while(end<characters.length&&LETTER.test(characters[end]))end++;
    return characters.slice(start,end).join('');
  }

  function visemeForBoundary({text,charIndex,step=0}={}){
    if(!Number.isInteger(step)||step<0)return Object.freeze({accepted:false,reason:'INVALID_STEP'});
    const token=tokenAt(text,charIndex);
    const sequence=sequenceForToken(token);
    if(!sequence.accepted)return sequence;
    return Object.freeze({...sequence,frame:sequence.frames[step%sequence.frames.length]});
  }

  return Object.freeze({VISEME_VERSION,frameForCharacter,sequenceForToken,visemeForBoundary});
});

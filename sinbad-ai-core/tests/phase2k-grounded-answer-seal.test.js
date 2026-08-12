'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const sealer=require('../verification/grounded-answer-seal.js');
function input(overrides={}){return {transactionId:'tx-2k',query:'Güvenlik şartı',answerHash:'a'.repeat(64),mapVerifierVersion:'sinbad-independent-answer-citation-map-verifier/2J-v1',evidenceIds:['e2','e1','e1'],...overrides};}

test('seal is deterministic immutable and canonicalizes evidence order',()=>{const first=sealer.seal(input()),second=sealer.seal(input({evidenceIds:['e1','e2']}));assert.equal(first.status,'ANSWER_SEALED');assert.deepEqual(first,second);assert.deepEqual(first.evidenceIds,['e1','e2']);assert.equal(sealer.isAuthenticSeal(first),true);assert.equal(sealer.isAuthenticSeal({...first}),false);assert.equal(sealer.isBound(first,input()),true);assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.evidenceIds));});

test('seal cannot replay across transaction query answer verifier or evidence boundaries',()=>{const value=sealer.seal(input()),mutations=[{transactionId:'other'},{query:'different'},{answerHash:'b'.repeat(64)},{mapVerifierVersion:'other'},{evidenceIds:['e1']}];for(const mutation of mutations)assert.equal(sealer.isBound(value,input(mutation)),false);});

test('copied forged malformed and empty seal inputs fail closed',()=>{const malformed=[input({transactionId:''}),input({answerHash:'bad'}),input({mapVerifierVersion:''}),input({evidenceIds:[]})];for(const value of malformed){const result=sealer.seal(value);assert.equal(result.status,'SEAL_INVALID');assert.equal(result.sealHash,null);assert.equal(sealer.isBound(result,value),false);}assert.equal(sealer.isBound({...sealer.seal(input())},input()),false);});

test('sealer invokes no model expert navigation or network',()=>{let model=0,expert=0,navigation=0,network=0;const before=[globalThis.SinbadModel,globalThis.SinbadExpert,globalThis.SinbadNavigation,globalThis.fetch];globalThis.SinbadModel={generate(){model++;}};globalThis.SinbadExpert={execute(){expert++;}};globalThis.SinbadNavigation={answer(){navigation++;}};globalThis.fetch=async()=>{network++;};try{assert.equal(sealer.seal(input()).status,'ANSWER_SEALED');assert.deepEqual({model,expert,navigation,network},{model:0,expert:0,navigation:0,network:0});}finally{[globalThis.SinbadModel,globalThis.SinbadExpert,globalThis.SinbadNavigation,globalThis.fetch]=before;}});

'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const composer=require('../grounding/verified-answer-composer.js');

function claim(claimId,statement='Safety requirement'){return Object.freeze({claimId,statement,supported:true,verificationStatus:'CLAIM_SUPPORTED',citationIds:Object.freeze([`citation:${claimId}`])});}
function citations(...claimIds){return claimIds.map(claimId=>Object.freeze({id:`citation:${claimId}`,claimId}));}

test('composer uses verified cited claims in deterministic identity order',()=>{const a=claim('a','Alpha rule'),b=claim('b','Beta rule'),resolved=citations('a','b'),first=composer.compose({claims:[b,a],citations:resolved}),second=composer.compose({claims:[a,b],citations:[...resolved].reverse()});assert.equal(first.status,'ANSWER_COMPOSED');assert.equal(first.answer,'Alpha rule Beta rule');assert.deepEqual(first,second);assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.claimIds));});

test('composer deduplicates exact repeated statements without hiding claim lineage',()=>{const result=composer.compose({claims:[claim('b'),claim('a')],citations:citations('a','b')});assert.equal(result.answer,'Safety requirement');assert.deepEqual(result.claimIds,['a','b']);assert.deepEqual(result.segments[0].claimIds,['a','b']);assert.deepEqual(result.segments[0].citationIds,['citation:a','citation:b']);assert.deepEqual(result.metrics,{verifiedClaimCount:2,uniqueStatementCount:1,deduplicatedStatementCount:1,segmentCount:1});});

test('unsupported unverified uncited empty and absent claims fail closed',()=>{const mutations=[{supported:false},{verificationStatus:'CLAIM_UNSUPPORTED'},{citationIds:[]},{statement:''}];for(const mutation of mutations){const result=composer.compose({claims:[{...claim('a'),...mutation}],citations:citations('a')});assert.equal(result.status,'COMPOSITION_INVALID');assert.equal(result.answer,null);}assert.equal(composer.compose({claims:[]}).status,'COMPOSITION_INVALID');});

test('stale fabricated and cross-claim citation identifiers fail closed',()=>{assert.equal(composer.compose({claims:[claim('a')],citations:[]}).status,'COMPOSITION_INVALID');assert.equal(composer.compose({claims:[claim('a')],citations:[{id:'citation:a',claimId:'b'}]}).status,'COMPOSITION_INVALID');});

test('composer invokes no model expert navigation or network',()=>{let model=0,expert=0,navigation=0,network=0;const before=[globalThis.SinbadModel,globalThis.SinbadExpert,globalThis.SinbadNavigation,globalThis.fetch];globalThis.SinbadModel={generate(){model++;}};globalThis.SinbadExpert={execute(){expert++;}};globalThis.SinbadNavigation={answer(){navigation++;}};globalThis.fetch=async()=>{network++;};try{assert.equal(composer.compose({claims:[claim('a')],citations:citations('a')}).status,'ANSWER_COMPOSED');assert.deepEqual({model,expert,navigation,network},{model:0,expert:0,navigation:0,network:0});}finally{[globalThis.SinbadModel,globalThis.SinbadExpert,globalThis.SinbadNavigation,globalThis.fetch]=before;}});

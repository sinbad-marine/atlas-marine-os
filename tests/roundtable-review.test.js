'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {selectedReviewers,validateReviewerKeys,assertSafeDiff,reviewRange}=require('../tools/roundtable-review.js');

test('requires an explicit reviewer selection',()=>{
  assert.throws(()=>selectedReviewers({}),/ROUNDTABLE_REVIEWERS/);
  assert.throws(()=>selectedReviewers({ROUNDTABLE_REVIEWERS:'   '}),/ROUNDTABLE_REVIEWERS/);
});

test('normalizes and deduplicates selected reviewers',()=>{
  assert.deepEqual([...selectedReviewers({ROUNDTABLE_REVIEWERS:' Grok,claude,grok '})],['grok','claude']);
});

test('rejects unknown reviewers',()=>{
  assert.throws(()=>selectedReviewers({ROUNDTABLE_REVIEWERS:'grok,other'}),/Unknown reviewer: other/);
});

test('fails closed when any selected reviewer key is missing',()=>{
  const selected=selectedReviewers({ROUNDTABLE_REVIEWERS:'claude,grok'});
  assert.throws(()=>validateReviewerKeys(selected,{ANTHROPIC_API_KEY:'set'}),/GROK_API_KEY/);
  assert.throws(()=>validateReviewerKeys(new Set(['grok']),{GROK_API_KEY:'   '}),/GROK_API_KEY/);
});

test('reports every missing selected reviewer key without exposing values',()=>{
  const selected=selectedReviewers({ROUNDTABLE_REVIEWERS:'claude,gemini,grok'});
  assert.throws(()=>validateReviewerKeys(selected,{GEMINI_API_KEY:'secret-value'}),error=>{
    assert.match(error.message,/ANTHROPIC_API_KEY/);
    assert.match(error.message,/GROK_API_KEY/);
    assert.doesNotMatch(error.message,/secret-value/);
    return true;
  });
});

test('accepts selected reviewers only when all corresponding keys exist',()=>{
  const selected=selectedReviewers({ROUNDTABLE_REVIEWERS:'gemini,grok'});
  assert.doesNotThrow(()=>validateReviewerKeys(selected,{GEMINI_API_KEY:'a',GROK_API_KEY:'b'}));
});

test('refuses added private keys and known provider token shapes',()=>{
  for(const value of [
    ['-----BEGIN PRIVATE',' KEY-----'].join(''),
    ['sk','-ant-','a'.repeat(24)].join(''),
    ['xai','-','b'.repeat(24)].join(''),
    ['ghp','_','c'.repeat(24)].join(''),
    ['AI','za','d'.repeat(24)].join('')
  ])assert.throws(()=>assertSafeDiff(`diff --git a/x b/x\n+${value}`),/potential secret/);
});

test('refuses long values assigned to credential-like names',()=>{
  assert.throws(()=>assertSafeDiff(`diff --git a/x b/x\n+api_key = '${'z'.repeat(32)}'`),/potential secret/);
  assert.throws(()=>assertSafeDiff(`diff --git a/x b/x\n+password: ${'p'.repeat(24)}`),/potential secret/);
});

test('allows environment variable names placeholders and removed secrets',()=>{
  assert.doesNotThrow(()=>assertSafeDiff(['diff --git a/x b/x','+const key=process.env.GROK_API_KEY;','+GROK_API_KEY=<set-in-user-environment>','-sk','-ant-aaaaaaaaaaaaaaaaaaaaaaaa'].join('\n')));
});

test('accepts only explicit bounded commit review ranges',()=>{
  assert.equal(reviewRange({}),null);
  assert.equal(reviewRange({ROUNDTABLE_RANGE:'4c719af^..4c719af'}),'4c719af^..4c719af');
  for(const value of ['HEAD','..HEAD','HEAD..','HEAD...main','--output=x..HEAD','HEAD..main;whoami'])assert.throws(()=>reviewRange({ROUNDTABLE_RANGE:value}),/explicit base\.\.head/u);
});

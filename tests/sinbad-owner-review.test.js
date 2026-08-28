const test=require('node:test');
const assert=require('node:assert/strict');
const ownerReview=require('../sinbad-owner-review.js');

test('local Academy opens the real loopback Owner review service',()=>{const opened=[];const integration=ownerReview.create({appUrl:'http://127.0.0.1:4177/'},{baseUrl:'http://127.0.0.1:4173/academy.html',openWindow:(...args)=>{opened.push(args);return {};}});assert.equal(integration.launch().safeFallback,false);assert.equal(opened[0][0],'http://127.0.0.1:4177/');});
test('hosted Academy opens a same-origin safe Owner review explanation',()=>{const opened=[];const integration=ownerReview.create({appUrl:'http://127.0.0.1:4177/'},{baseUrl:'https://sinbad-marine.github.io/atlas-marine-os/academy.html',openWindow:(...args)=>{opened.push(args);return {};}});assert.equal(integration.launch().safeFallback,true);assert.equal(opened[0][0],'https://sinbad-marine.github.io/atlas-marine-os/owner-review-local-required.html');assert.equal(opened[0][0].includes('127.0.0.1'),false);});
test('Owner review launcher rejects a remote configured service',()=>{assert.throws(()=>ownerReview.create({appUrl:'https://example.com/review'}),/OWNER_REVIEW_REQUIRES_LOOPBACK/);});

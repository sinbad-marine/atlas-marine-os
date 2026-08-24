'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const curriculum=require('../sinbad-ai-core/visual-library/scripts/build-visual-curriculum.js');
test('visual curriculum covers every versioned manifest topic with a deterministic quality policy',()=>{const result=curriculum.build();assert.ok(result.topicCount>5000);assert.equal(result.topics.length,result.topicCount);assert.equal(result.qualityPolicy.defaultMaximumImages,1);assert.deepEqual(result.qualityPolicy.rejectTraits,['qr-code','logo-only','text-only','cover-page']);assert.equal(new Set(result.topics.map(item=>item.topicId)).size,result.topicCount);});
test('visual needs distinguish photographs, procedures, diagrams and chart plates',()=>{assert.equal(curriculum.visualNeed('inflatable liferaft'),'photograph');assert.equal(curriculum.visualNeed('liferaft launch procedure'),'procedure-sequence');assert.equal(curriculum.visualNeed('vector diagram'),'technical-diagram');assert.equal(curriculum.visualNeed('chart symbols'),'chart-or-symbol');});

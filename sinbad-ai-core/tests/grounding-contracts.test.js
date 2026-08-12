const test=require('node:test');
const assert=require('node:assert/strict');
const contracts=require('../grounding/contracts.js');

test('creates a deeply immutable grounded answer contract',()=>{
  const result=contracts.groundedAnswer({status:'GROUNDED',answer:'Fact.',claims:[{id:'c1',text:'Fact.',evidenceIds:['e1'],citationIds:['x'],supported:true}],citations:[{id:'x',claimId:'c1',evidenceId:'e1'}],composition:{status:'ANSWER_COMPOSED',answer:'Fact.',answerHash:'hash',claimIds:['c1'],segments:[{startOffset:0,endOffset:5,offsetEncoding:'UTF16_CODE_UNIT',statementHash:'span',claimIds:['c1'],citationIds:['x'],bindings:[{claimId:'c1',citationIds:['x']}]}],metrics:{verifiedClaimCount:1,segmentCount:1}},confidence:{state:'HIGH',reasons:['SUPPORTED']}});
  assert.equal(result.version,'sinbad-grounded-answer/2J');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.claims),true);
  assert.equal(Object.isFrozen(result.claims[0]),true);
  assert.equal(Object.isFrozen(result.composition),true);
  assert.equal(Object.isFrozen(result.composition.claimIds),true);
  assert.equal(Object.isFrozen(result.composition.segments),true);
  assert.equal(Object.isFrozen(result.composition.segments[0]),true);
  assert.equal(Object.isFrozen(result.composition.segments[0].citationIds),true);
  assert.equal(Object.isFrozen(result.composition.segments[0].bindings),true);
  assert.equal(Object.isFrozen(result.composition.segments[0].bindings[0].citationIds),true);
  assert.equal(Object.isFrozen(result.composition.metrics),true);
  assert.equal(result.security.documentContentPolicy,'DATA_ONLY');
  assert.equal(result.security.expertExecutionPerformed,false);
});

test('represents unavailable citation metadata as null without fabrication',()=>{
  const citation=contracts.citation({id:'x',claimId:'c',evidenceId:'e'});
  assert.equal(citation.sourceId,null);
  assert.equal(citation.location.page,null);
  assert.equal(citation.publishedAt,null);
  assert.equal(citation.version,null);
  assert.equal(citation.metadataComplete,false);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const evaluator=require('../retrieval/evidence-evaluator.js');

function item(overrides={}){
  return {id:'a:1',sourceId:'a',sourceType:'publication',evidenceClass:'verified-authoritative',
    authority:'authoritative',verified:true,title:'Official A',content:'data',relevance:.9,
    claims:[{key:'minimum-depth',value:'4.2 m',scope:'harbor-x'}],...overrides};
}

test('accepts sufficiently relevant authoritative evidence',()=>{
  const result=evaluator.evaluate({items:[item()],requireAuthoritative:true,safetyCritical:true});
  assert.equal(result.status,'EVIDENCE_SUFFICIENT');
  assert.equal(result.conclusive,true);
  assert.equal(result.authoritative.length,1);
});

test('returns SOURCE_INSUFFICIENT when memory is the only evidence',()=>{
  const result=evaluator.evaluate({items:[item({evidenceClass:'memory-context',authority:'authoritative',verified:true})],requireAuthoritative:true});
  assert.equal(result.status,'SOURCE_INSUFFICIENT');
  assert.equal(result.conclusive,false);
  assert.equal(result.reason,'AUTHORITATIVE_EVIDENCE_NOT_FOUND');
});

test('rejects evidence below the relevance threshold with a traceable reason',()=>{
  const result=evaluator.evaluate({items:[item({relevance:.2})],requireAuthoritative:true,minimumRelevance:.5});
  assert.equal(result.status,'SOURCE_INSUFFICIENT');
  assert.equal(result.selected.length,0);
  assert.equal(result.rejected[0].reason,'LOW_RELEVANCE');
});

test('detects structured claim conflicts across meaningful sources',()=>{
  const result=evaluator.evaluate({items:[
    item(),item({id:'b:2',sourceId:'b',title:'Official B',claims:[{key:'minimum-depth',value:'3.7 m',scope:'harbor-x'}]})
  ],requireAuthoritative:true,safetyCritical:true});
  assert.equal(result.status,'EVIDENCE_CONFLICT');
  assert.equal(result.conclusive,false);
  assert.equal(result.conflicts[0].claim,'harbor-x:minimum-depth');
  assert.deepEqual(result.conflicts[0].values.map(x=>x.sourceIds[0]),['a','b']);
});

test('does not let memory create or resolve authoritative claim conflicts',()=>{
  const result=evaluator.evaluate({items:[
    item(),item({id:'m:1',sourceId:'m',evidenceClass:'memory-context',claims:[{key:'minimum-depth',value:'2 m',scope:'harbor-x'}]})
  ],requireAuthoritative:true,safetyCritical:true});
  assert.equal(result.status,'EVIDENCE_SUFFICIENT');
  assert.equal(result.conflicts.length,0);
});


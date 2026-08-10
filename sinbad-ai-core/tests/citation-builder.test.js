const test=require('node:test');
const assert=require('node:assert/strict');
const builder=require('../grounding/citation-builder.js');
const evidence=require('../retrieval/contracts.js');

function official(overrides={}){
  return evidence.evidence({id:'e1',sourceId:'official',sourceType:'publication',evidenceClass:'verified-authoritative',authority:'authoritative',verified:true,title:'Official Pilot',location:{section:'Harbor',page:12},publishedAt:'2026-01-01',version:'2',relevance:.9,...overrides});
}

test('maps claims only to real selected evidence and preserves source metadata',()=>{
  const result=builder.build({selected:[official()],claims:[{id:'c1',text:'Depth is published.',evidenceIds:['e1'],requiresAuthoritative:true}]});
  assert.equal(result.errors.length,0);
  assert.equal(result.claims[0].supported,true);
  assert.equal(result.citations[0].sourceId,'official');
  assert.equal(result.citations[0].location.page,'12');
  assert.equal(result.citations[0].version,'2');
});

test('rejects orphan and rejected evidence references',()=>{
  const result=builder.build({selected:[official()],rejected:[{item:official({id:'e2'}),reason:'LOW_RELEVANCE'}],claims:[
    {id:'c1',text:'Bad',evidenceIds:['missing']},{id:'c2',text:'Rejected',evidenceIds:['e2']}
  ]});
  assert.deepEqual(result.errors.filter(x=>x.reason.endsWith('EVIDENCE_REFERENCE')).map(x=>x.reason),['ORPHAN_EVIDENCE_REFERENCE','REJECTED_EVIDENCE_REFERENCE']);
  assert.equal(result.citations.length,0);
});

test('memory, secondary, and user documents cannot support an authoritative claim',()=>{
  for(const evidenceClass of ['memory-context','secondary','user-provided']){
    const item=official({evidenceClass,authority:'authoritative',verified:true});
    const result=builder.build({selected:[item],claims:[{id:'c',text:'Claim',evidenceIds:['e1'],requiresAuthoritative:true}]});
    assert.equal(result.claims[0].supported,false);
    assert.equal(result.errors.some(x=>x.reason==='AUTHORITATIVE_SUPPORT_MISSING'),true);
    assert.notEqual(result.citations[0].sourceClass,'verified-authoritative');
  }
});

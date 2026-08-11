const test=require('node:test');
const assert=require('node:assert/strict');
const builder=require('../grounding/citation-builder.js');
const evidence=require('../retrieval/contracts.js');
const verifier=require('../verification/claim-support-verifier.js');const fixture=require('./phase2e-test-fixtures.js');

function official(overrides={}){
  const content=overrides.content||'Depth is published.';return evidence.evidence({id:'e1',sourceId:'official',sourceType:'publication',evidenceClass:'verified-authoritative',authority:'authoritative',verified:true,title:'Official Pilot',content,location:{section:'Harbor',page:12},publishedAt:'2026-01-01',version:'2',relevance:.9,provenance:fixture.lineage(content),...overrides});
}

test('maps claims only to real selected evidence and preserves source metadata',()=>{
  const item=official(),claim=fixture.exactClaim({content:item.content,statement:'Depth is published.'}),verification=verifier.verify(claim,{selected:[item]});const result=builder.build({selected:[item],claims:[claim],verifications:[verification]});
  assert.equal(result.errors.length,0);
  assert.equal(result.claims[0].supported,true);
  assert.equal(result.citations[0].sourceId,'official');
  assert.equal(result.citations[0].location.page,'12');
  assert.equal(result.citations[0].version,'2');
});

test('rejects orphan and rejected evidence references',()=>{
  const item=official(),rejected=official({id:'e2',provenance:fixture.lineage('Depth is published.',{chunkId:'chunk-2'})});const claims=[fixture.exactClaim({content:item.content,statement:'Bad',evidenceId:'missing'}),fixture.exactClaim({content:rejected.content,statement:'Depth',evidenceId:'e2'})];const rejectedList=[{item:rejected,reason:'LOW_RELEVANCE'}];const verifications=claims.map(claim=>verifier.verify(claim,{selected:[item],rejected:rejectedList}));const result=builder.build({selected:[item],rejected:rejectedList,claims,verifications});
  assert.deepEqual(result.errors.map(x=>x.reason),['CLAIM_UNSUPPORTED','CLAIM_UNSUPPORTED']);
  assert.equal(result.citations.length,0);
});

test('memory, secondary, and user documents cannot support an authoritative claim',()=>{
  for(const evidenceClass of ['memory-context','secondary','user-provided']){
    const item=official({evidenceClass,authority:'authoritative',verified:true});const claim=fixture.exactClaim({content:item.content,statement:'Depth',requiresAuthoritative:true});const verification=verifier.verify(claim,{selected:[item]});
    const result=builder.build({selected:[item],claims:[claim],verifications:[verification]});
    assert.equal(result.claims[0].supported,false);
    assert.equal(result.errors.some(x=>['CLAIM_AUTHORITY_INSUFFICIENT','CLAIM_UNSUPPORTED'].includes(x.reason)),true);
    assert.equal(result.citations.length,0);
  }
});

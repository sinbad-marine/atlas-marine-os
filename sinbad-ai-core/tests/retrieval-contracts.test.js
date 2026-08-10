const test=require('node:test');
const assert=require('node:assert/strict');
const contracts=require('../retrieval/contracts.js');
const retrieverModule=require('../retrieval/offline-library-retriever.js');

test('normalizes immutable evidence with traceable source metadata',()=>{
  const item=contracts.evidence({
    id:'src:4',sourceId:'src',sourceType:'publication',evidenceClass:'verified-authoritative',
    authority:'authoritative',verified:true,title:'Pilot',content:'Harbor data',relevance:.8,
    location:{section:'Approaches',page:12,chunk:4,uri:'offline://pilot'},version:'2026'
  });
  assert.equal(item.maySatisfyAuthoritativeRequirement,true);
  assert.equal(item.location.page,'12');
  assert.equal(item.instructionPolicy,'DATA_ONLY');
  assert.equal(Object.isFrozen(item),true);
  assert.equal(Object.isFrozen(item.location),true);
});

test('never promotes memory or unverified material to authoritative evidence',()=>{
  const memory=contracts.evidence({evidenceClass:'memory-context',authority:'authoritative',verified:true});
  const claimed=contracts.evidence({evidenceClass:'verified-authoritative',authority:'authoritative',verified:false});
  assert.deepEqual([memory.authority,memory.verified,memory.maySatisfyAuthoritativeRequirement],['advisory',false,false]);
  assert.deepEqual([claimed.evidenceClass,claimed.verified,claimed.maySatisfyAuthoritativeRequirement],['secondary',false,false]);
});

test('searches injected offline library without changing its source and chunk shape',()=>{
  const sources=[{id:'pilot-1',title:'Aegean Pilot',evidenceClass:'verified-authoritative',authorityLevel:'authoritative',verified:true,edition:'2026'}];
  const chunks=[{source_id:'pilot-1',chunk_index:7,title:'Aegean Pilot',category:'pilotage',content:'İzmir yaklaşma kanalı ve fenerler'}];
  const original=JSON.stringify({sources,chunks});
  const retriever=retrieverModule.create({sources,chunks,now:()=> '2026-08-10T12:00:00.000Z'});
  const result=retriever.search({query:'İzmir yaklaşma',limit:5,requireAuthoritative:true});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].sourceId,'pilot-1');
  assert.equal(result.items[0].location.chunk,'7');
  assert.equal(result.items[0].verified,true);
  assert.equal(JSON.stringify({sources,chunks}),original);
});

test('defaults library material to secondary unless verification is explicit',()=>{
  const retriever=retrieverModule.create({
    sources:[{id:'note-1',title:'Crew note',authority:'Important person'}],
    chunks:[{source_id:'note-1',chunk_index:0,content:'Anchor holding note'}]
  });
  const item=retriever.search({query:'anchor holding'}).items[0];
  assert.equal(item.evidenceClass,'secondary');
  assert.equal(item.verified,false);
  assert.equal(item.maySatisfyAuthoritativeRequirement,false);
});

test('rejects an empty retrieval query',()=>{
  assert.throws(()=>contracts.query({query:'  '}),/retrieval query is required/);
});


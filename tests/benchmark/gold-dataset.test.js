'use strict';
// FAST DETERMINISTIC BENCHMARK CHECK: the gold datasets are well-formed and every maritime anchor is a
// verbatim substring of the verified source text. No bridge, no model, no network.
const test=require('node:test');
const assert=require('node:assert/strict');
const gold=require('./lib/gold');

test('every category file exists, has unique ids and a documented method',()=>{
  const sets=gold.loadAll();
  const all=new Set();
  for(const [category,set] of Object.entries(sets)){
    assert.equal(set.category,category);assert.match(String(set.method||''),/PASS|NOT SUPPORTED|records/iu,`${category} must document its scoring method`);
    for(const item of set.items){assert.ok(item.id,`${category}: item id`);assert.ok(!all.has(item.id),`duplicate id ${item.id}`);all.add(item.id);}
  }
  assert.equal(Object.keys(sets).length,gold.CATEGORIES.length);
});

test('maritime anchors are verbatim in the verified ISM/ISPS/MLC manifests and name a real sourceId',()=>{
  const problems=gold.validateMaritime(gold.load('maritime-reasoning'));
  assert.deepEqual(problems,[]);
  const sources=gold.verifiedSources();
  assert.ok(sources.size>=16+19+28,`expected at least 63 verified sources, got ${sources.size}`);
});

test('contradiction authoritative phrases quote the verified texts where a sourceId is implied',()=>{
  const sources=gold.verifiedSources();
  const expectations={'CT-01':['IMO-ISM-A741-18-EL12','twelve months'],'CT-02':['ILO-MLC2006-T1-REG1.1','16 years'],'CT-03':['IMO-ISM-A741-18-EL4','highest level of management'],'CT-04':['IMO-ISPS-A-SEC12','designated on each ship'],'CT-05':['IMO-ISPS-A-SEC5','contracting governments'],'CT-06':['ILO-MLC2006-T2-REG2.2','monthly'],'CT-07':['ILO-MLC2006-T2-REG2.5','no cost to themselves'],'CT-08':['IMO-ISPS-A-SEC9','approved by the administration']};
  for(const [id,[sourceId,phrase]] of Object.entries(expectations)){assert.ok(sources.has(sourceId),sourceId);assert.equal(gold.anchorIsVerbatim(sourceId,phrase).ok,true,`${id}: ${phrase}`);}
});

test('coding tasks carry executable gold cases and repo-state items carry provenance',()=>{
  for(const task of gold.load('coding').items){assert.match(task.functionName,/^[a-zA-Z_$][\w$]*$/u);assert.ok(Array.isArray(task.cases)&&task.cases.length>=2,task.id);}
  for(const item of gold.load('repo-state').items){assert.ok(item.provenance&&item.truthTokens.length,item.id);assert.ok(['hash','text'].includes(item.truthKind),item.id);}
  for(const item of gold.load('stale-state').items)assert.ok(item.truth,item.id);
});

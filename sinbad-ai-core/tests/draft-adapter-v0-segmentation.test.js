'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {d,input,pieces}=require('./helpers/draft-adapter-v0-builders.js');
const cut=(text,changes)=>{const a=d.adapt(input(text,changes));assert.equal(a.status,'ADAPTED',a.reasonCode);return {a,claims:pieces(a,text),markers:a.segments.map(x=>x.markers.join(',')),skipped:a.skipped.map(x=>`${x.reason}:${text.slice(x.start,x.end)}`)};};

test('sentences become claims in order, each bound to the markers written inside it; an unmarked sentence is a claim without evidence',()=>{
  const r=cut('The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2]. This is general knowledge about shipping.');
  assert.deepEqual(r.claims,['The ISM Code requires a safety management system [S1].','The company must designate a person ashore [S2].','This is general knowledge about shipping.']);
  assert.deepEqual(r.markers,['S1','S2','']);assert.deepEqual(r.a.chainPass.draft.claims.map(c=>[c.claimId,c.evidenceIds.join(',')]),[['c1','ev-doc-1'],['c2','ev-doc-2'],['c3','']]);
  assert.deepEqual(r.a.chainPass.draft.citations,[{citationId:'cit-S1',evidenceId:'ev-doc-1'},{citationId:'cit-S2',evidenceId:'ev-doc-2'}]);
});

test('a marker written after the end of a sentence cites that sentence, never the next one (no lending of citations)',()=>{
  const r=cut('A designated person provides the link between ship and shore. [S1] Masters hold overriding authority.[S2] Next sentence here.');
  assert.deepEqual(r.claims,['A designated person provides the link between ship and shore. [S1]','Masters hold overriding authority.[S2]','Next sentence here.']);assert.deepEqual(r.markers,['S1','S2','']);
  const multi=cut('First fact.[S1][S2] Second fact. [S2]  Third fact!');assert.deepEqual(multi.markers,['S1,S2','S2','']);
  const quoted=cut('He wrote "drills are recorded." [S1] Another one.');assert.deepEqual(quoted.markers,['S1','']);
  // A marker alone on its own line cites nothing and is recorded, not attached to a neighbour on another line.
  const alone=cut('First fact.\n[S1]\nSecond fact.');assert.deepEqual(alone.markers,['','']);assert.deepEqual(alone.skipped,['NO_WORDS:[S1]']);assert.deepEqual(alone.a.chainPass.draft.citations.map(c=>c.citationId),['cit-S1']);
});

test('decimals, abbreviations and initials do not end a sentence; over-splitting is preferred to merging',()=>{
  assert.deepEqual(cut('Per Reg. 5 the limit is 3.5 m, e.g. in ballast [S1]. Dr. A. Smith agrees [S2]. Rule no. 7 applies.').claims,['Per Reg. 5 the limit is 3.5 m, e.g. in ballast [S1].','Dr. A. Smith agrees [S2].','Rule no. 7 applies.']);
  assert.deepEqual(cut('Örn. bu kişi DPA olarak bilinir. Bkz. bölüm 4.2 [S1].').claims,['Örn. bu kişi DPA olarak bilinir.','Bkz. bölüm 4.2 [S1].']);
  // "etc." is deliberately not an abbreviation here: it usually ends a sentence, and a wrong merge would lend [S1] to the second one.
  assert.deepEqual(cut('Log drills, audits etc. The rest is unsupported [S1].').markers,['','S1']);
  assert.deepEqual(cut('Stop! Is it safe? It is… Yes.').claims,['Stop!','It is…','Yes.']);
});

test('structure that asserts nothing is skipped and recorded, never silently dropped: headings, lead-ins, questions, code blocks',()=>{
  const r=cut('# Summary\nThe requirements are:\n- A policy must exist [S1].\n* Drills are recorded [S2].\n1. Audits are annual.\n2) Records are kept.\nWould you like more detail?');
  assert.deepEqual(r.claims,['A policy must exist [S1].','Drills are recorded [S2].','Audits are annual.','Records are kept.']);
  assert.deepEqual(r.skipped,['HEADING:# Summary','LEAD_IN:The requirements are:','QUESTION:Would you like more detail?']);
  const code=cut('Run this:\n```\nnpm test [S2]\n```\nIt prints the totals [S1].');assert.deepEqual(code.claims,['It prints the totals [S1].']);assert.ok(code.a.warnings.includes('CODE_BLOCK_NOT_SEGMENTED'));
  // A marker inside skipped text is still a citation of the draft.
  assert.deepEqual(code.a.chainPass.draft.citations.map(c=>c.citationId),['cit-S1','cit-S2']);
  const stats=r.a.stats;assert.equal(stats.claims,4);assert.equal(stats.claimsWithMarkers,2);assert.equal(stats.claimsWithoutMarkers,2);assert.equal(stats.claimChars+stats.skippedChars<=stats.answerChars,true);
  const asked=cut('Do you mean the 2020-01-01 amendments?');assert.deepEqual(asked.claims,[]);assert.deepEqual([...asked.a.warnings],['NO_CLAIMS_FOUND','PASSAGES_SUPPLIED_BUT_NO_MARKER_USED','SKIPPED_QUESTION_CONTAINS_SPECIFIC_VALUES']);
});

test('nothing the answer says is reworded: every claim is an exact slice of the answer, hashed as written, and always ASSERTED',()=>{
  const text='  According to the memo, the audit passed [S1].   The master says he approves.  ';const r=cut(text);
  for(const [i,c] of r.a.chainPass.draft.claims.entries()){const seg=r.a.segments[i];assert.equal(c.text,text.slice(seg.start,seg.end));assert.equal(c.contentHash,require('./helpers/draft-adapter-v0-builders.js').s.sha256(c.text));assert.equal(c.assertionMode,'ASSERTED');assert.equal(c.originRef,'model:draft');assert.equal(c.originScopeRef,'scope:alpha');}
  assert.deepEqual(r.claims,['According to the memo, the audit passed [S1].','The master says he approves.']);
  assert.equal(r.a.chainPass.draft.draftHash,r.a.provenance.answerHash);assert.equal(r.a.interprets,false);assert.equal(r.a.rewrites,false);
});

test('a marker no passage carries stays visible as a citation to an evidence id that does not exist',()=>{
  const r=cut('Internal audits are annual [S1]. The master may override [S9].');
  assert.deepEqual(r.a.segments[1].unknownMarkers,['S9']);assert.deepEqual(r.a.chainPass.draft.claims[1].evidenceIds,['unknown-marker-S9']);
  assert.deepEqual(r.a.chainPass.draft.citations[1],{citationId:'cit-S9',evidenceId:'unknown-marker-S9'});assert.equal(r.a.chainPass.evidenceSet.items.some(i=>i.evidenceId==='unknown-marker-S9'),false);
  assert.ok(r.a.warnings.includes('UNKNOWN_MARKERS_PRESERVED'));assert.equal(r.a.stats.unknownMarkers,1);assert.equal(r.a.stats.passagesUnused,1);
  // Look-alikes are not markers.
  assert.deepEqual(cut('See [S0], [s1], [S1000] and [Source 1] for context.').markers,['']);
});

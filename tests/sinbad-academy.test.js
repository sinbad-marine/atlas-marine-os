const test=require('node:test');
const assert=require('node:assert/strict');
const academy=require('../sinbad-academy.js');

const data={chunks:[
  {source_id:'noaa-charts',title:'NOAA Nautical Charts',authority:'NOAA',category:'chart-reading',url:'https://noaa.example',chunk_index:0,content:'A chart datum is a reference surface used for charted depths. Mariners must check scale, units, datum, edition and corrections before use.'},
  {source_id:'uscg-rules',title:'Navigation Rules',authority:'USCG',category:'colregs-navigation-rules',url:'https://uscg.example',chunk_index:0,content:'Every vessel shall at all times maintain a proper look-out by sight and hearing as well as by all available means appropriate to the circumstances.'}
]};

test('ranks official offline training chunks',()=>{
  const hits=academy.search('chart datum scale',data);
  assert.equal(hits[0].chunk.source_id,'noaa-charts');
  assert.ok(hits[0].score>0);
});

test('builds a cited offline answer with a safety boundary',()=>{
  const result=academy.answer('What must I check on a chart?',data);
  assert.equal(result.mode,'offline-official-training');
  assert.match(result.text,/\[S1\]/);
  assert.match(result.text,/kaptan onayı gerekir/);
});

test('provides structured lessons and practice questions',()=>{
  const lesson=academy.lesson('chart-reading',data);
  assert.equal(lesson.title,'Harita Okuma ve Hidrografi');
  assert.ok(lesson.objectives.length>=3);
  assert.equal(academy.quiz('chart-reading').length,1);
});

test('does not invent an answer without matching evidence',()=>{
  assert.equal(academy.answer('galley refrigerator maintenance',data),null);
});

test('registers the complete scanned GASM navigation exam series and the human-verified full answer key',()=>{
  const pages=academy.quiz('gasm-seyir-sinav');
  assert.equal(pages.length,71);
  assert.equal(pages.reduce((sum,page)=>sum+page.questionCount,0),643);
  assert.deepEqual(pages.slice(0,10).map(page=>[page.firstQuestion,page.lastQuestion]),[[1,8],[9,17],[18,27],[28,36],[37,46],[47,56],[57,66],[67,76],[77,86],[87,95]]);
  assert.deepEqual(pages.slice(-5).map(page=>[page.firstQuestion,page.lastQuestion]),[[601,607],[608,616],[617,625],[626,634],[635,644]]);
  assert.deepEqual(pages.slice(29,34).map(page=>[page.firstQuestion,page.lastQuestion]),[[266,271],[273,282],[283,291],[292,297],[298,305]]);
  assert.deepEqual(academy.gasmSeyirMissingRanges,[[272,272]]);
  assert.ok(pages.every(page=>page.answer===null));
  assert.equal(pages.filter(page=>page.answerStatus==='official-key-verified').length,71);
  assert.equal(Object.keys(academy.gasmSeyirVerifiedAnswerKey).length,644);
  assert.deepEqual(
    [academy.gasmSeyirVerifiedAnswerKey[1],academy.gasmSeyirVerifiedAnswerKey[15],academy.gasmSeyirVerifiedAnswerKey[217],academy.gasmSeyirVerifiedAnswerKey[513],academy.gasmSeyirVerifiedAnswerKey[601],academy.gasmSeyirVerifiedAnswerKey[644]],
    ['B','C','B','B','B','A']
  );
  assert.ok(pages.every(page=>Object.keys(page.answers).length===page.questionCount));
  assert.ok(pages.every(page=>/^\.\/assets\/gasm-seyir\/.+\.png$/.test(page.image)));
});

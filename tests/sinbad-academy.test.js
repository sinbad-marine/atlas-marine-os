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

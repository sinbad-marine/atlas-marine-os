const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const edge=fs.readFileSync('supabase/functions/sinbad-answer/index.ts','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('cloud retrieval exposes only bounded, provenance-linked PDF page visuals',()=>{
  assert.match(edge,/const wantsSourceVisuals = \(question: string\)/);
  assert.match(edge,/const isContextualFollowUp = \(question: string\)/);
  assert.match(edge,/previousUserMessage/);
  assert.match(edge,/retrievalQuestion = wantsSourceVisuals\(question\) && isContextualFollowUp\(question\)/);
  assert.match(edge,/words\(retrievalQuestion\)/);
  assert.match(edge,/const pageForChunk = \(content: string, terms: string\[\]\)/);
  assert.match(edge,/document_id,source_mime_type/);
  assert.match(edge,/sources\.filter\(\(source: any\) => source\.documentId && source\.page && \/pdf\/i\.test/);
  assert.match(edge,/kind: 'pdf-page'/);
  assert.match(edge,/VERIFIED SOURCE PAGE VISUALS/);
  assert.match(edge,/Do not claim that no visual is available/);
  assert.match(edge,/Do not invent a copyright or licensing restriction/);
  assert.match(edge,/return json\(\{ answer, spokenSummary, sources, visuals,/);
});

test('follow-up conversation keeps the original speaker roles for contextual understanding',()=>{
  assert.match(edge,/history\.map\(\(item: any\) => \(\{ role: item\.role,/);
  assert.doesNotMatch(edge,/history\.map\(\(item: any\) => \(\{ role: 'user'/);
});

test('Sinbad chat renders source pages from authenticated Atlas storage, not invented image URLs',()=>{
  assert.match(app,/function sinbadVisualCards\(visuals=\[\]\)/);
  assert.match(app,/visuals\.slice\(0,3\)/);
  assert.match(app,/async function openSinbadSourceVisual\(button\)/);
  assert.match(app,/from\('documents'\)\.select\('bucket_id,object_path,original_filename,mime_type'\)/);
  assert.match(app,/cloudClient\.storage\.from\(documentRow\.bucket_id\)\.download\(documentRow\.object_path\)/);
  assert.match(app,/view\.pdf\.getPage\(view\.page\)/);
  assert.match(app,/view\.page=Math\.max\(1,Math\.min\(view\.page,view\.pdf\.numPages\)\)/);
  assert.doesNotMatch(app,/sinbad-source-visual[^\n]*https?:\/\//);
  assert.match(css,/\.sinbad-source-page-viewport canvas/);
});

test('visual references are attached only to the matching assistant answer',()=>{
  assert.match(app,/let sinbadPendingSourceVisuals=\[\];/);
  assert.match(app,/function consumeSinbadSourceVisuals\(\)/);
  assert.match(app,/trustedAiData\.visuals/);
  assert.match(app,/addSinbadMessage\('sinbad',answer,consumeSinbadSourceVisuals\(\)\)/);
});

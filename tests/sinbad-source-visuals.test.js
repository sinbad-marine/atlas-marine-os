const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const edge=fs.readFileSync('supabase/functions/sinbad-answer/index.ts','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('cloud retrieval exposes bounded PDF page visuals only to owner and developer roles',()=>{
  assert.match(edge,/const wantsSourceVisuals = \(question: string\)/);
  assert.match(edge,/const isContextualFollowUp = \(question: string\)/);
  assert.match(edge,/previousUserMessage/);
  assert.match(edge,/includeSourceVisuals = body\.includeSourceVisuals === true/);
  assert.match(edge,/sourceVisualsRequested = includeSourceVisuals \|\| wantsSourceVisuals\(question\)/);
  assert.match(edge,/canAccessPrivateSources = membership\.role === 'owner' \|\| membership\.role === 'developer'/);
  assert.match(edge,/visuals = canAccessPrivateSources && sourceVisualsRequested/);
  assert.match(edge,/responseSources = canAccessPrivateSources \? sources : \[\]/);
  assert.match(edge,/sourceAccess = canAccessPrivateSources \? 'privileged' : 'restricted'/);
  assert.match(edge,/wantsSourceDetails\(question\)/);
  assert.match(edge,/mode: 'source-access-restricted'/);
  assert.match(edge,/retrievalQuestion = sourceVisualsRequested && isContextualFollowUp\(question\)/);
  assert.match(edge,/words\(retrievalQuestion\)/);
  assert.match(edge,/const pageForChunk = \(content: string, terms: string\[\]\)/);
  assert.match(edge,/document_id,source_mime_type/);
  assert.match(edge,/sources\.filter\(\(source: any\) => source\.documentId && source\.page && \/pdf\/i\.test/);
  assert.match(edge,/kind: 'pdf-page'/);
  assert.match(edge,/VERIFIED SOURCE PAGE VISUALS/);
  assert.match(edge,/Do not claim that no visual is available/);
  assert.match(edge,/Do not invent a copyright or licensing restriction/);
  assert.match(edge,/answer: deliveredAnswer, spokenSummary: deliveredSpokenSummary, sources: responseSources, visuals, sourceAccess/);
  assert.match(edge,/stripPrivateCitationMarkers\(answer\)/);
});

test('follow-up conversation keeps the original speaker roles for contextual understanding',()=>{
  assert.match(edge,/history\.map\(\(item: any\) => \(\{ role: item\.role,/);
  assert.doesNotMatch(edge,/history\.map\(\(item: any\) => \(\{ role: 'user'/);
});

test('Atlas document centre also blocks private source browsing and transfer outside owner or developer roles',()=>{
  assert.match(app,/function roleCanAccessPrivateSources\(\)\{[\s\S]*?\['owner','developer'\]\.includes\(currentWorkspaceRole\)/);
  assert.match(app,/async function loadCloudFiles\(\)\{\s*if\(!roleCanAccessPrivateSources\(\)\)/);
  assert.match(app,/async function openCloudFile\(bucket,path,filename=''\)\{\s*if\(!roleCanAccessPrivateSources\(\)\)/);
  assert.match(app,/async function downloadCloudFile\(bucket,path,filename='atlas-file'\)\{\s*if\(!roleCanAccessPrivateSources\(\)\)/);
  assert.match(app,/async function shareCloudFile\(bucket,path,filename='atlas-file'\)\{\s*if\(!roleCanAccessPrivateSources\(\)\)/);
});

test('Sinbad chat renders source pages from authenticated Atlas storage, not invented image URLs',()=>{
  assert.match(app,/function sinbadVisualCards\(visuals=\[\]\)/);
  assert.match(app,/visuals\.slice\(0,3\)/);
  assert.match(app,/async function openSinbadSourceVisual\(button\)/);
  assert.match(app,/from\('documents'\)\.select\('bucket_id,object_path,original_filename,mime_type'\)/);
  assert.match(app,/cloudClient\.storage\.from\(documentRow\.bucket_id\)\.download\(documentRow\.object_path\)/);
  assert.match(app,/pdf\.getPage\(safePage\)/);
  assert.doesNotMatch(app,/sinbad-source-visual[^\n]*https?:\/\//);
  assert.match(css,/\.sinbad-source-visual-stage canvas/);
});

test('visual references are attached only to the matching assistant answer',()=>{
  assert.match(app,/let sinbadPendingSourceVisuals=\[\];/);
  assert.match(app,/function consumeSinbadSourceVisuals\(\)/);
  assert.match(app,/trustedAiData\.visuals/);
  assert.match(app,/addSinbadMessage\('sinbad',answer,consumeSinbadSourceVisuals\(\)\)/);
});

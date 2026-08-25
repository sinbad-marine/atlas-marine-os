const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const edge=fs.readFileSync('supabase/functions/sinbad-answer/index.ts','utf8');
const css=fs.readFileSync('styles.css','utf8');
const storagePolicy=fs.readFileSync('supabase/migrations/20260823_private_source_storage_access.sql','utf8');

test('cloud retrieval exposes bounded PDF page visuals only to owner and developer roles',()=>{
  assert.match(edge,/const wantsSourceVisuals = \(question: string\)/);
  assert.match(edge,/const isContextualFollowUp = \(question: string\)/);
  assert.match(edge,/previousUserMessage/);
  assert.match(edge,/includeSourceVisuals = body\.includeSourceVisuals === true/);
  assert.match(edge,/suppressSourceVisuals = body\.suppressSourceVisuals === true/);
  assert.match(edge,/sourceVisualsRequested = !suppressSourceVisuals && \(includeSourceVisuals \|\| wantsSourceVisuals\(question\)\)/);
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

test('legacy local library bytes and indexed text are also denied outside owner or developer roles',()=>{
  assert.match(app,/function requirePrivateLocalLibraryAccess\(action='access local private library files'\)/);
  assert.match(app,/if\(\$\('uploadDocs'\)\) \$\('uploadDocs'\)\.onclick=async\(\)=>\{\s*if\(!requirePrivateLocalLibraryAccess\('add local private library files'\)\)return/);
  assert.match(app,/async function renderDocuments\(\)\{[\s\S]*?if\(!roleCanAccessPrivateSources\(\)\)/);
  for(const [name,action] of [
    ['previewFile','open'],['downloadFile','download'],['printFile','print'],
    ['shareFile','share'],['renameFile','rename'],['removeFile','delete']
  ])assert.match(app,new RegExp(`async function ${name}\\(id\\)\\{if\\(!requirePrivateLocalLibraryAccess\\('${action} local private library files'\\)\\)return`));
  assert.match(app,/\$\('knowledgeSearchBtn'\)\.onclick=async\(\)=>\{if\(!requirePrivateLocalLibraryAccess\('search local private library files'\)\)/);
  assert.match(app,/\['uploadDocs','docFiles','docFolder','docTags','knowledgeQuery','knowledgeSearchBtn'\][\s\S]*?el\.disabled=!roleCanAccessPrivateSources\(\)/);
});

test('dashboard counts and local Sinbad fallback cannot disclose private library inventory',()=>{
  assert.match(app,/async function renderSummary\(\)\{[\s\S]*?if\(!roleCanAccessPrivateSources\(\)\)\{[\s\S]*?\['sumFiles','sumPubs','sumCharts','sumStorage'\]/);
  assert.match(app,/const canAccessPrivateLibrary=roleCanAccessPrivateSources\(\);\s*const files=canAccessPrivateLibrary\?await dbAll\(\):\[\]/);
  assert.match(app,/if\(q\.includes\('chart'\)\)\{\s*if\(!canAccessPrivateLibrary\)return 'Private chart archive identities/);
  assert.match(app,/if\(q\.includes\('publication'\) \|\| q\.includes\('solas'\) \|\| q\.includes\('marpol'\)\)\{\s*if\(!canAccessPrivateLibrary\)return 'Private publication identities/);
  assert.match(app,/async function refreshCloudSummary\(\)\{[\s\S]*?if\(!roleCanAccessPrivateSources\(\)\)\{[\s\S]*?\['sumFiles','sumPubs','sumCharts','sumStorage'\]/);
});

test('private cloud library mutations enforce the same role gate as their hidden controls',()=>{
  assert.match(app,/function roleCanManagePrivateLibrary\(\)\{\s*return roleCanManageLibrary\(\)&&roleCanAccessPrivateSources\(\);\s*\}/);
  assert.match(app,/async function repairCloudDocumentKnowledge\([\s\S]*?if\(!roleCanManagePrivateLibrary\(\)\)throw new Error/);
  for(const name of ['indexCloudDocument','renameCloudFile','deleteCloudFile']){
    assert.match(app,new RegExp(`async function ${name}\\([^)]*\\)\\{[\\s\\S]{0,220}?if\\(!roleCanManagePrivateLibrary\\(\\)\\)`));
  }
});

test('Storage RLS limits original library bytes to owner and authorized developer roles',()=>{
  assert.match(storagePolicy,/alter policy atlas_storage_select_member\s+on storage\.objects/i);
  assert.match(storagePolicy,/array\['atlas-documents'::text, 'nautical-publications'::text\]/);
  assert.match(storagePolicy,/array\['owner'::workspace_role, 'developer'::workspace_role\]/);
  assert.match(storagePolicy,/bucket_id <> all \(array\['atlas-documents'::text, 'nautical-publications'::text\]\)/);
});

test('Sinbad chat renders source pages from authenticated Atlas storage, not invented image URLs',()=>{
  assert.match(app,/function sinbadVisualCards\(visuals=\[\]\)/);
  assert.match(app,/visuals\.slice\(0,3\)/);
  assert.match(app,/async function openSinbadSourceVisual\(button\)/);
  assert.match(app,/async function openSinbadSourceVisual\(button\)\{\s*if\(!roleCanAccessPrivateSources\(\)\)/);
  assert.match(app,/from\('documents'\)\.select\('bucket_id,object_path,original_filename,mime_type'\)/);
  assert.match(app,/cloudClient\.storage\.from\(documentRow\.bucket_id\)\.download\(documentRow\.object_path\)/);
  assert.match(app,/view\.pdf\.getPage\(view\.page\)/);
  assert.match(app,/view\.page=Math\.max\(1,Math\.min\(view\.page,view\.pdf\.numPages\)\)/);
  assert.match(app,/function openSinbadSourceDialog\(sourceView\)/);
  assert.match(app,/event\.key==='ArrowLeft'/);
  assert.doesNotMatch(app,/sinbad-source-visual[^\n]*https?:\/\//);
  assert.match(css,/\.sinbad-source-page-viewport canvas/);
  assert.match(css,/\.sinbad-source-dialog::backdrop/);
});

test('visual references are attached only to the matching assistant answer',()=>{
  assert.match(app,/let sinbadPendingSourceVisuals=\[\];/);
  assert.match(app,/function consumeSinbadSourceVisuals\(\)/);
  assert.match(app,/trustedAiData\.visuals/);
  assert.match(app,/trustedAiData\.sourceAccess==='privileged'&&roleCanAccessPrivateSources\(\)/);
  assert.match(app,/canRetainPrivateSourceVisuals&&Array\.isArray\(trustedAiData\.visuals\)/);
  assert.match(app,/const atlasVisuals=await window\.SinbadVisuals/);
  assert.match(app,/addSinbadMessage\('sinbad',answer,\[\.\.\.consumeSinbadSourceVisuals\(\),\.\.\.atlasVisuals\]\.slice\(0,3\)\)/);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');

test('dashboard actions, cloud summary and Sinbad tools use expandable menus',()=>{
  assert.match(html,/class="action-menu hero-action-menu"/);
  assert.match(html,/class="action-menu cloud-summary-menu"/);
  assert.match(html,/class="action-menu sinbad-tools-menu"/);
  assert.match(html,/<summary><span aria-hidden="true">☰<\/span> Quick actions<\/summary>/);
  assert.match(html,/<summary><span aria-hidden="true">☰<\/span> Atlas Cloud summary<\/summary>/);
  assert.match(html,/<summary><span aria-hidden="true">☰<\/span> Sinbad tools<\/summary>/);
  assert.match(css,/\.action-menu>summary/);
});

test('connected dashboard summary cannot be overwritten by local IndexedDB counts',()=>{
  const start=app.indexOf('async function renderSummary()');
  const end=app.indexOf('\nasync function renderAll()',start);
  const implementation=app.slice(start,end);
  assert.match(implementation,/cloudClient&&cloudSession\?\.user&&selectedWorkspaceId/);
  assert.match(implementation,/await refreshCloudSummary\(\);\s*return;/);
  assert.ok(implementation.indexOf('refreshCloudSummary')<implementation.indexOf('dbAll()'));
});

test('existing action wiring remains intact inside the menus',()=>{
  assert.equal((html.match(/class="btn sinbad-prompt"/g)||[]).length,4);
  assert.match(app,/document\.querySelectorAll\('\.sinbad-prompt'\)/);
  assert.match(html,/data-open="cloud-documents"/);
  assert.match(html,/data-open="sinbad"/);
});

test('public cloud check and member sign-in rebuild a missing cloud client from safe defaults',()=>{
  assert.match(app,/if\(!cloudClient\)\{\s*initCloudClient\(\);\s*await restoreCloudSession\(\);\s*\}\s*output\.textContent='Atlas Cloud is reachable and ready/);
  const signInStart=app.indexOf('async function gatewaySignIn()');
  const signInEnd=app.indexOf('\nasync function createAccount',signInStart);
  const signIn=app.slice(signInStart,signInEnd);
  assert.match(signIn,/if\(!cloudClient\)\{\s*initCloudClient\(\);\s*await restoreCloudSession\(\);\s*\}/);
  assert.ok(signIn.indexOf('initCloudClient()')<signIn.indexOf("Atlas Cloud connection is not ready"));
});

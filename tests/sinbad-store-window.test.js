const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('store.html','utf8');
const script=fs.readFileSync('store-window.js','utf8');
test('dashboard launches public Store in one resizable independent window',()=>{assert.match(app,/openDashboardWorkspaceWindow/);assert.match(app,/new URL\('\.\/store\/index\.html',location\.href\)/);assert.match(app,/sinbadMarineStore/);assert.match(app,/resizable=yes,scrollbars=yes/)});
test('standalone Store keeps catalog, cart and return controls',()=>{assert.match(html,/id="storeGrid"/);assert.match(html,/id="storeCartDrawer"/);assert.match(html,/id="storeBack"/);assert.match(html,/id="storeHome"/);assert.match(script,/atlas_store_cart/);assert.match(script,/window\.opener\.focus/);assert.match(script,/STORE_DATA/)});
test('public commerce surface is constrained by a deny-by-default browser policy',()=>{
  const publicStore=fs.readFileSync('store/index.html','utf8');
  assert.match(publicStore,/Content-Security-Policy/);
  assert.match(publicStore,/default-src 'self'/);
  assert.match(publicStore,/connect-src 'none'/);
  assert.match(publicStore,/form-action 'none'/);
  assert.match(publicStore,/noindex,nofollow,noarchive/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('dashboard module launches use named resizable native windows',()=>{
  assert.match(app,/const MODULE_WINDOW_PARAM='module'/u);
  assert.match(app,/function openWorkspaceWindow\(id,\{bucket=''\}=\{\}\)/u);
  assert.match(app,/window\.open\(url\.href,`sinbadModule_/u);
  assert.match(app,/popup=yes,resizable=yes,scrollbars=yes/u);
  assert.match(app,/function openWorkspace\(id,options=\{\}\)\{return MODULE_WINDOW_ID===id\?activateWorkspace\(id\):openWorkspaceWindow\(id,options\)\}/u);
});

test('module windows remember bounded geometry and close independently',()=>{
  assert.match(app,/MODULE_WINDOW_GEOMETRY_PREFIX='atlas_module_window_geometry_v1:'/u);
  assert.match(app,/Math\.max\(520,/u);
  assert.match(app,/Math\.max\(420,/u);
  assert.match(app,/width:outerWidth,height:outerHeight,left:screenX,top:screenY/u);
  assert.match(app,/if\(MODULE_WINDOW_ID\)\{saveModuleWindowGeometry\(\);window\.close\(\);return;\}/u);
});

test('standalone module mode removes dashboard chrome and keeps only the selected workspace',()=>{
  assert.match(app,/document\.body\.classList\.add\('module-window-mode'\)/u);
  assert.match(app,/activateWorkspace\(MODULE_WINDOW_ID,\{scroll:false,render:false\}\)/u);
  assert.match(css,/body\.module-window-mode\.authenticated main>:not\(\.workspace\)\{display:none!important\}/u);
  assert.match(css,/body\.module-window-mode\.authenticated \.topbar,body\.module-window-mode\.authenticated \.sinbad-float,body\.module-window-mode\.authenticated footer\{display:none!important\}/u);
});

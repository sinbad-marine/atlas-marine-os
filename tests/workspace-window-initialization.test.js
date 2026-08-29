const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('direct independent workspace URLs initialize their workspace controls',()=>{
  assert.match(app,/function initializeWorkspaceSurface\(id\)[\s\S]*if\(id==='enc-viewer'\)initEncViewer\(\)/);
  assert.match(app,/setTimeout\(\(\)=>initializeWorkspaceSurface\(workspaceWindowId\),0\)/);
});

test('in-page workspace navigation uses the same initialization path',()=>{
  assert.match(app,/function openWorkspace\(id\)[\s\S]*renderAll\(\);initializeWorkspaceSurface\(id\)/);
});

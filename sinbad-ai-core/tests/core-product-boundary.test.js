'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const coreRoot=path.resolve(__dirname,'..');
const forbiddenProductIdentities=['zabit','akademi','academy','gasm'];

function runtimeFiles(directory){
  const files=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(entry.name==='tests'||entry.name==='docs')continue;
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...runtimeFiles(target));
    else if(entry.isFile()&&['.js','.cjs','.mjs','.json'].includes(path.extname(entry.name)))files.push(target);
  }
  return files.sort((a,b)=>a.localeCompare(b,'en'));
}

test('Core runtime contains no direct product identity literals',()=>{
  const violations=[];
  for(const file of runtimeFiles(coreRoot)){
    const relative=path.relative(coreRoot,file).replaceAll('\\','/');
    const content=fs.readFileSync(file,{encoding:'utf8'}).normalize('NFKC').toLowerCase();
    for(const identity of forbiddenProductIdentities){
      if(content.includes(identity))violations.push({file:relative,identity});
    }
  }
  assert.deepEqual(violations,[],
    'Direct product identities belong in clients/modules, not Core runtime. This literal guard does not replace semantic architecture review.');
});

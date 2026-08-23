'use strict';

const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const RELEASE_FILES=Object.freeze([
  'index.html','styles.css','app.js','academy.html','academy.css','academy-window.js',
  'academy-professor.html','academy-professor.css','academy-professor-guidance.css','academy-professor.js','sinbad-professor.js','academy-professor-v3.html','academy-professor-handsfree.css','academy-professor-handsfree.js','pilot-data.js','route-data.js',
  'official-publications.js','sinbad-core.js','sinbad-training-data.js',
  'sinbad-academy.js','sinbad-navigation.js','sinbad-navigation-assistant.js',
  'sinbad-route-visualizer.js','sinbad-character-engine.js','sinbad-character-rig.js',
  'sinbad-performance-director.js','sw.js','manifest.webmanifest','icon-192.png',
  'icon-512.png','vendor/ol-10.6.1.js','vendor/ol-10.6.1.css',
  'vendor/land-110m.json','supabase/functions/sinbad-answer/core-decision.js'
  ,'vendor/supabase-2.112.3.js','vendor/mammoth-1.12.1.min.js','vendor/tesseract-5.1.1.min.js'
  ,'assets/captain-sinbad/captain-sinbad-idle-master.png','assets/captain-sinbad/captain-sinbad-listening.png'
  ,'assets/captain-sinbad/captain-sinbad-thinking.png','assets/captain-sinbad/captain-sinbad-speaking.png'
  ,'assets/captain-sinbad/captain-sinbad-idle-blink-v1.png','assets/captain-sinbad/captain-sinbad-speaking-mbp-v1.png'
  ,'assets/captain-sinbad/captain-sinbad-speaking-o-v1.png','assets/captain-sinbad/captain-sinbad-laughing-v1.png'
  ,'assets/captain-sinbad/captain-sinbad-walk-a-v1.png','assets/captain-sinbad/captain-sinbad-walk-b-v1.png'
  ,'assets/captain-sinbad/captain-sinbad-board-teaching.png'
]);
const SOURCE_OVERRIDES=Object.freeze({
  'vendor/supabase-2.112.3.js':'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
  'vendor/mammoth-1.12.1.min.js':'node_modules/mammoth/mammoth.browser.min.js',
  'vendor/tesseract-5.1.1.min.js':'node_modules/tesseract.js/dist/tesseract.min.js'
});

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function buildPagesArtifact(destination){
  const target=path.resolve(destination);
  const relative=path.relative(ROOT,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('RELEASE_TARGET_OUTSIDE_REPOSITORY');
  if(fs.existsSync(target))throw new Error('RELEASE_TARGET_ALREADY_EXISTS');
  const entries=[];
  for(const name of RELEASE_FILES){
    const source=path.join(ROOT,...(SOURCE_OVERRIDES[name]||name).split('/'));
    const stat=await fsp.lstat(source);
    if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`RELEASE_SOURCE_NOT_REGULAR_FILE:${name}`);
    const bytes=await fsp.readFile(source);
    const output=path.join(target,...name.split('/'));
    await fsp.mkdir(path.dirname(output),{recursive:true});
    await fsp.writeFile(output,bytes,{flag:'wx'});
    entries.push(Object.freeze({path:name,bytes:bytes.length,sha256:sha256(bytes)}));
  }
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  const manifest={schemaVersion:'sinbad-pages-release/v1',sourceCommit:process.env.GITHUB_SHA||'LOCAL_UNATTESTED',files:entries};
  const encoded=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`,'utf8');
  await fsp.writeFile(path.join(target,'release-manifest.json'),encoded,{flag:'wx'});
  return Object.freeze({...manifest,manifestSha256:sha256(encoded)});
}

if(require.main===module){
  buildPagesArtifact(process.argv[2]||path.join(ROOT,'.release','pages'))
    .then(result=>process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
}

module.exports=Object.freeze({ROOT,RELEASE_FILES,buildPagesArtifact});

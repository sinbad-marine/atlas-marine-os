const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('visible release, Core and app assets share one live version',()=>{
  const visible=html.match(/<div class="version">● v(\d+)\.(\d+)\.(\d+)<\/div>/);
  assert.ok(visible);
  const assetVersion=`${visible[1]}${visible[2].padStart(2,'0')}${visible[3]}`;
  assert.match(html,new RegExp(`sinbad-core\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`app\\.js\\?v=${assetVersion}`));
  assert.match(worker,new RegExp(`sinbad-marine-v${visible[1]}\\.${visible[2]}\\.${visible[3]}-`));
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const deployGuide=fs.readFileSync(path.join(root,'UPLOAD_ALL_FILES_TR.md'),'utf8');
const edgeGuide=fs.readFileSync(path.join(root,'supabase/functions/sinbad-answer/README_TR.md'),'utf8');
const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');

test('visible release, Core and app assets share one live version',()=>{
  const visible=html.match(/<div class="version">● v(\d+)\.(\d+)\.(\d+)<\/div>/);
  assert.ok(visible);
  const assetVersion=`${visible[1]}${visible[2].padStart(2,'0')}${visible[3]}`;
  assert.match(html,new RegExp(`sinbad-core\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`core-decision\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`sinbad-navigation\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`sinbad-navigation-assistant\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`sinbad-route-visualizer\\.js\\?v=${assetVersion}`));
  assert.match(html,new RegExp(`app\\.js\\?v=${assetVersion}`));
  assert.match(worker,new RegExp(`sinbad-marine-v${visible[1]}\\.${visible[2]}\\.${visible[3]}-`));
  assert.match(worker,/supabase\/functions\/sinbad-answer\/core-decision\.js/);
  assert.match(worker,/\.\/sinbad-navigation\.js/);
  assert.match(worker,/\.\/sinbad-navigation-assistant\.js/);
  assert.match(worker,/\.\/sinbad-route-visualizer\.js/);
  assert.match(html,/\.\/vendor\/ol-10\.6\.1\.css/);
  assert.match(html,/\.\/vendor\/ol-10\.6\.1\.js/);
  assert.doesNotMatch(html,/cdn\.jsdelivr\.net\/npm\/ol@/);
  assert.match(worker,/\.\/vendor\/land-110m\.json/);
  assert.equal(fs.existsSync(path.join(root,'vendor','land-110m.json')),true);
});

test('release guide preserves fail-closed Edge-before-web deployment order',()=>{
  const edgeStep=deployGuide.indexOf("Supabase `sinbad-answer` Edge Function'ını deploy edin");
  const webStep=deployGuide.indexOf('GitHub Pages statik paketini yayınlayın');
  assert.ok(edgeStep>=0&&webStep>edgeStep);
  assert.match(deployGuide,/CORE_GATE_BLOCKED/);
  assert.match(edgeGuide,/DECISION_SUPPORT_ONLY/);
});

test('generated voice and Supabase temporary artifacts stay outside Git',()=>{
  assert.match(ignore,/^\.codex-\*\.wav$/m);
  assert.match(ignore,/^supabase\/\.temp\/$/m);
});

test('primary README reports the current Core gate without production overclaim',()=>{
  assert.match(readme,/Sinbad Marine v8\.20\.14/);
  assert.match(readme,/DECISION_SUPPORT_ONLY/);
  assert.match(readme,/PLAN_ONLY/);
  assert.match(readme,/not certified ECDIS\/ECS/);
  assert.doesNotMatch(readme,/Captain Sinbad live AI\s*\n- Crew cloud synchronization/);
});

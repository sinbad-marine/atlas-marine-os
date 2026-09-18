'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('console-master-style.css','utf8');
const app=fs.readFileSync('app.js','utf8');
const release=fs.readFileSync('tools/build-pages-artifact.js','utf8');
const contract=JSON.parse(fs.readFileSync('config/ui-design-contract.json','utf8'));
const canonical='home-owner-canonical-exec-1c46e9f6-4e4e-4e80-baa9-7328e22b2f05.png';

test('PC Home is locked to the exact Owner canonical reference',()=>{
  const grid=html.match(/<section class="console-domain-grid"[\s\S]*?<\/section>/u)?.[0]||'';
  assert.equal((grid.match(/class="console-domain-card\b/gu)||[]).length,7);
  assert.doesNotMatch(grid,/data-master=/u);
  assert.equal((grid.match(/\b0[1-7]\s*·/gu)||[]).length,7);
  assert.match(html,/<body[^>]*data-console-art="monet"/u);
  assert.match(css,new RegExp(canonical.replaceAll('.','\\.'),'u'));
  assert.doesNotMatch(css,/home-domain-art-atlas-v13\.png/u);
  assert.doesNotMatch(css,/home-turner-current-layout-brand-lockup-v12\.png/u);
  assert.equal(contract.approvedVisualBaselines.pcHome.canonicalReference.filename,'exec-1c46e9f6-4e4e-4e80-baa9-7328e22b2f05.png');
  assert.equal(contract.approvedVisualBaselines.pcHome.canonicalReference.sha256,'6e25eaa32b9726fb1a03053c6837802b3b71e53553fe5c4bdd4c76f7d958a3ce');
  assert.equal(contract.approvedVisualBaselines.pcHome.canonicalReference.width,1672);
  assert.equal(contract.approvedVisualBaselines.pcHome.canonicalReference.height,941);
});

test('Home status defaults fail closed and provides an explicit refresh',()=>{
  assert.match(html,/data-console-status="local"[\s\S]*?NOT VERIFIED/u);
  assert.match(html,/data-console-status="cloud"[\s\S]*?NOT VERIFIED/u);
  assert.match(html,/id="consoleStatusRefresh"/u);
  assert.match(app,/setConsoleStatus\('local','unknown','NOT VERIFIED'\)/u);
  assert.match(app,/cloudOffline=.*not connected/u);
  assert.doesNotMatch(app,/setConsoleStatus\('agents','ready'/u);
});

test('Home cards are keyboard operable and preserve every existing tool',()=>{
  assert.equal((html.match(/class="console-domain-card[^"]*"[^>]*tabindex="0"[^>]*role="button"/gu)||[]).length,7);
  assert.match(app,/event\.key==='Enter'\|\|event\.key===' '/u);
  for(const id of ['resources','cloud-documents','sinbad','studio-console','cloud-control','admin-settings','fleet','pilot','routes','crew','location-intelligence','camera-archive','captains-logbook','document-submissions','enc-viewer'])assert.match(html,new RegExp(`data-open="${id}"`,'u'),id);
});

test('Home cards preview with restrained motion before opening once',()=>{
  assert.match(css,/scale\(1\.025\)/u);
  assert.match(css,/160ms cubic-bezier\(\.2,\.75,\.25,1\)/u);
  assert.match(css,/prefers-reduced-motion:reduce/u);
  assert.match(app,/CONSOLE_CARD_OPEN_MOTION_MS=160/u);
  assert.match(app,/CONSOLE_CARD_OPEN_FALLBACK_MS=200/u);
  assert.match(app,/dataset\.opening==='true'/u);
  assert.match(app,/prepareConsoleCardDestination/u);
  assert.match(app,/prepareSinbadAcademyCardDestination/u);
  assert.match(app,/event\.key==='Enter'\|\|event\.key===' '/u);
});

test('release includes only the locked canonical Home visual authority',()=>{
  assert.match(release,/'console-master-style\.css'/u);
  assert.match(release,/'assets\/console-art\/home-owner-canonical-exec-1c46e9f6-4e4e-4e80-baa9-7328e22b2f05\.png'/u);
  assert.doesNotMatch(release,/'assets\/console-art\/home-turner-current-layout-brand-lockup-v12\.png'/u);
  assert.doesNotMatch(release,/'assets\/console-art\/home-domain-art-atlas-v13\.png'/u);
});

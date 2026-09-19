'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const hash=file=>crypto.createHash('sha256').update(read(file).replace(/\r\n?/gu,'\n'),'utf8').digest('hex');
const html=read('index.html');
const app=read('app.js');
const designContract=JSON.parse(read('config/ui-design-contract.json'));

const section=id=>{
  const start=html.indexOf(`<section id="${id}"`);if(start<0)return'';
  const next=html.indexOf('<section id="',start+12);
  return html.slice(start,next<0?html.length:next);
};

test('Yacht Management inner layers retain their routes, selected art and functional controls',()=>{
  const contracts={
    fleet:{asset:'02-fleet-and-yacht-management-B.png',ids:['vName','vType','vFlag','vLoa','vBeam','vDraft','vCruise','vFuel','vWater','vNotes','saveVessel','fleetList']},
    crew:{asset:'03-crew-B.png',ids:['crewName','crewRank','crewNationality','crewPassport','crewMedical','crewStcw','crewVisa','crewContract','crewContact','crewNotes','saveCrew','crewList']},
    'captains-logbook':{asset:'04-captain-logbook-B.png',ids:['voicePulse','startVoiceWatch','stopVoiceWatch','pushToTalkLog','logDraftText','logCategory','attachLogPosition','saveLogDraft','recordLogAudio','stopLogAudio','logLocalClock','logUtcClock','logPositionPreview','logDraftList','startEmergencyRecord']},
    'camera-archive':{asset:'05-camera-media-archive-A.png',ids:['cameraPermissionBanner','cameraPreview','cameraPlaceholder','startCamera','switchCamera','capturePhoto','startVideoRecording','stopVideoRecording','closeCamera','mobileMediaCapture','mediaArchiveNote','uploadCapturedMedia','mediaUploadStatus','capturedMediaGallery']}
  };
  for(const [id,contract] of Object.entries(contracts)){
    const page=section(id);
    assert.match(page,/yacht-detail-page/u,`${id} uses the shared detail framework`);
    assert.match(page,/data-master="rembrandt"/u,`${id} keeps the Rembrandt language`);
    assert.ok(page.includes(contract.asset),`${id} uses the Owner-selected art`);
    assert.match(page,/data-open="yacht-operations"/u,`${id} returns to Yacht Management`);
    for(const control of contract.ids)assert.ok(page.includes(`id="${control}"`),`${id} retains #${control}`);
  }
});

test('Fleet and Crew storage schemas stay compatible with existing data consumers',()=>{
  assert.match(app,/get\('atlas_fleet'\)[\s\S]*?name:\$\('vName'\)\.value[\s\S]*?notes:\$\('vNotes'\)\.value/u);
  assert.match(app,/get\('atlas_crew'\)[\s\S]*?name:\$\('crewName'\)\.value[\s\S]*?notes:\$\('crewNotes'\)\.value/u);
  assert.match(app,/const LOGBOOK_STORAGE_KEY='sinbad_captains_logbook_v1'/u);
  assert.match(app,/classification:'restricted',ai_index_allowed:false/u);
});

test('Owner-approved B/B/B/A inner-layer selections remain locked in the design contract',()=>{
  const lock=designContract.ownerVisualLocks.yachtManagementInnerLayers;
  assert.equal(lock.status,'OWNER_APPROVED_LOCKED');
  assert.equal(lock.artistLanguage,'rembrandt');
  assert.equal(lock.immutable,true);
  assert.deepEqual(Object.fromEntries(Object.entries(lock.layers).map(([name,layer])=>[name,layer.selection])),{
    fleet:'B',crew:'B',captainsLogbook:'B',cameraArchive:'A'
  });
});

test('Marine Store remains content-identical to the approved baseline',()=>{
  const expected={
    'store.html':'58e4ec0d7a60eda612d207b986ac8dda593f6eea2a2df1e74164317aa673e828',
    'store-window.js':'282c7486ba1202f8f6e73bea5c7f25250cca0c985336d5cbf9b540002be32e06',
    'store-data.js':'88b0ac6e57a9414ab3a63ae7e6360ede80400542ca213980afd4ecf5e92df2dd',
    'styles.css':'a7b45fc9c86ad19afa18c7e99507cb30f25d83f0dd964d6d0364cb25a57684a4'
  };
  for(const [file,digest] of Object.entries(expected))assert.equal(hash(file),digest,`${file} changed outside Owner scope`);
  const store=section('store');
  for(const id of ['storeCategories','storeSearch','storeResultCount','storeGrid'])assert.ok(store.includes(`id="${id}"`));
});

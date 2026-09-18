'use strict';
// Project 2 Phase 4.1 - Draft Adapter v0 (inert, deterministic free-text -> structured draft). Not
// wired into any live path, not part of the package exports. Owner GO of 2026-09-18 (first step of
// the order recommended by the Phase 4 readiness report; scope "PROJECT 2 / PHASE 4.1 - DRAFT
// ADAPTER v0 ONLY").
const adapter=require('./draft-adapter-v0');
const chainComponent=require('../chain');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-draft-adapter-component/0-v1',
  role:'FREE_TEXT_TO_STRUCTURED_DRAFT',
  status:'INERT_COMPONENT',
  performsIo:false,
  interprets:false,
  rewrites:false,
  executes:false,
  approves:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  // What its output is shaped for; the adapter itself runs none of it.
  feeds:chainComponent.MANIFEST.modules.input,
  modules:Object.freeze({adapter:adapter.VERSION,input:adapter.INPUT_VERSION,output:adapter.OUTPUT_VERSION,segmenter:adapter.SEGMENTER_VERSION})
});
module.exports=Object.freeze({MANIFEST,adapter});

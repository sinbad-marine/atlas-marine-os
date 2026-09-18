'use strict';
// Project 2 Phase 3.5 - Co-Pilot v0 (inert, deterministic checker layer, verdict-only). Not wired
// into any live path, not part of the package exports. Owner GO "PROJECT 2 / PHASE 3.5 - CO-PILOT
// v0 ONLY" (2026-09-18).
const copilot=require('./copilot-v0');
const sentinelComponent=require('../sentinel');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-copilot-component/0-v1',
  role:'DETERMINISTIC_CHECKER',
  status:'INERT_COMPONENT',
  performsIo:false,
  executes:false,
  decides:false,
  rewrites:false,
  approves:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  observationEngine:sentinelComponent.MANIFEST.version,
  modules:Object.freeze({copilot:copilot.VERSION,input:copilot.INPUT_VERSION,review:copilot.REVIEW_VERSION,checkerset:copilot.CHECKERSET_VERSION})
});
module.exports=Object.freeze({MANIFEST,copilot});

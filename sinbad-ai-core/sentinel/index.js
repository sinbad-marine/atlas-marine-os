'use strict';
// Project 2 Phase 3.3 - Sentinel v0 (inert, observe-only). Not wired into any live path, not part of
// the package exports. Owner GO "PROJECT 2 / PHASE 3.3 - SENTINEL v0 ONLY" (2026-09-17).
const sentinel=require('./sentinel-v0');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-sentinel-component/0-v1',
  role:'OBSERVER',
  status:'INERT_COMPONENT',
  performsIo:false,
  executes:false,
  decides:false,
  keepsState:false,
  callsModel:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  modules:Object.freeze({sentinel:sentinel.VERSION,input:sentinel.INPUT_VERSION,report:sentinel.REPORT_VERSION,ruleset:sentinel.RULESET_VERSION})
});
module.exports=Object.freeze({MANIFEST,sentinel});

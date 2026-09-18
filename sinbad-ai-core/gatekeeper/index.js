'use strict';
// Project 2 Phase 3.4 - Gatekeeper v0 (inert, deterministic post-gate, label-only). Not wired into
// any live path, not part of the package exports. Owner GO "PROJECT 2 / PHASE 3.4 - GATEKEEPER v0
// ONLY" (2026-09-17).
const gatekeeper=require('./gatekeeper-v0');
const sentinelComponent=require('../sentinel');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-gatekeeper-component/0-v1',
  role:'DETERMINISTIC_GATE',
  status:'INERT_COMPONENT',
  stage:'POST',
  performsIo:false,
  executes:false,
  delivers:false,
  enforces:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  observationEngine:sentinelComponent.MANIFEST.version,
  modules:Object.freeze({gatekeeper:gatekeeper.VERSION,input:gatekeeper.INPUT_VERSION,decision:gatekeeper.DECISION_VERSION,ruleset:gatekeeper.RULESET_VERSION})
});
module.exports=Object.freeze({MANIFEST,gatekeeper});

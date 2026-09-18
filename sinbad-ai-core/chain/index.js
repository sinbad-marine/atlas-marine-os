'use strict';
// Project 2 Phase 3.7 - Offline Chain v0 (inert, deterministic paper-only composition). Not wired
// into any live path, not part of the package exports. Owner GO of 2026-09-18 (scope delegated to
// and chosen as "PROJECT 2 / PHASE 3.7 - OFFLINE CHAIN v0 ONLY").
const chain=require('./chain-v0');
const copilotComponent=require('../copilot');
const gatekeeperComponent=require('../gatekeeper');
const pilotComponent=require('../pilot');
const sentinelComponent=require('../sentinel');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-offline-chain-component/0-v1',
  role:'OFFLINE_COMPOSITION',
  status:'INERT_COMPONENT',
  offlineOnly:true,
  performsIo:false,
  producesDrafts:false,
  delivers:false,
  executes:false,
  approves:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  // The inert components this one runs in memory, in this order, on caller-supplied data only.
  composes:Object.freeze([sentinelComponent.MANIFEST.version,copilotComponent.MANIFEST.version,gatekeeperComponent.MANIFEST.version,pilotComponent.MANIFEST.version]),
  modules:Object.freeze({chain:chain.VERSION,input:chain.INPUT_VERSION,transcript:chain.TRANSCRIPT_VERSION})
});
module.exports=Object.freeze({MANIFEST,chain});

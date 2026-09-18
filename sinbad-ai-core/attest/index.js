'use strict';
// Project 2 Phase 3.8 - Record Attestation v0 (inert, deterministic origin envelope for sealed
// records). Not wired into any live path, not part of the package exports. Owner GO of 2026-09-18
// (the Owner approved the recommended next phase; scope "PROJECT 2 / PHASE 3.8 - RECORD
// ATTESTATION v0 ONLY").
const attest=require('./attest-v0');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-attest-component/0-v1',
  role:'RECORD_ORIGIN_ATTESTATION',
  status:'INERT_COMPONENT',
  originOnly:true,
  performsIo:false,
  generatesKeys:false,
  storesKeys:false,
  executes:false,
  approves:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  algorithm:attest.ALGORITHM,
  attests:attest.KIND_NAMES,
  modules:Object.freeze({attest:attest.VERSION,envelope:attest.ENVELOPE_VERSION,check:attest.CHECK_VERSION})
});
module.exports=Object.freeze({MANIFEST,attest});

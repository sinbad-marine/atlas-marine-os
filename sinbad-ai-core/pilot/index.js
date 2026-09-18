'use strict';
// Project 2 Phase 3.6 - Pilot v0 (inert, deterministic control-state recommender, record-only). Not
// wired into any live path, not part of the package exports. Owner GO "PROJECT 2 / PHASE 3.6 -
// PILOT v0 ONLY" (2026-09-18).
const pilot=require('./pilot-v0');
const gatekeeperComponent=require('../gatekeeper');
const copilotComponent=require('../copilot');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-pilot-component/0-v1',
  role:'CONTROL_STATE_RECOMMENDER',
  status:'INERT_COMPONENT',
  recommendationOnly:true,
  performsIo:false,
  executes:false,
  approves:false,
  rewrites:false,
  keepsState:false,
  callsModel:false,
  grantsAuthority:false,
  runsOtherComponents:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  // Record formats Pilot v0 reads and verifies; it never runs the components that produce them.
  reads:Object.freeze({gatekeeperDecision:gatekeeperComponent.MANIFEST.modules.decision,copilotReview:copilotComponent.MANIFEST.modules.review}),
  modules:Object.freeze({pilot:pilot.VERSION,input:pilot.INPUT_VERSION,decision:pilot.DECISION_VERSION,ruleset:pilot.RULESET_VERSION})
});
module.exports=Object.freeze({MANIFEST,pilot});

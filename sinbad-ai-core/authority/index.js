'use strict';
// Project 2 Phase 3.1 - inert authority contracts. No I/O, no execution, no wiring into any live path.
// Owner IMPLEMENTATION GO "PHASE 3.1 CONTRACTS ONLY" (2026-09-17).
const authorityModel=require('./authority-model');
const claimLabels=require('./claim-labels');
const taskContext=require('./task-context');
const evidenceSet=require('./evidence-set');
const copilotVerdict=require('./copilot-verdict');
const gateDecision=require('./gate-decision');
const MANIFEST=Object.freeze({
  version:'sinbad-authority-contracts/1-v1',
  status:'INERT_CONTRACTS',
  performsIo:false,
  executes:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  modules:Object.freeze({authorityModel:authorityModel.VERSION,claimLabels:claimLabels.VERSION,taskContext:taskContext.VERSION,evidenceSet:evidenceSet.VERSION,evidenceMap:evidenceSet.MAP_VERSION,copilotVerdict:copilotVerdict.VERSION,gateDecision:gateDecision.VERSION})
});
module.exports=Object.freeze({MANIFEST,authorityModel,claimLabels,taskContext,evidenceSet,copilotVerdict,gateDecision});

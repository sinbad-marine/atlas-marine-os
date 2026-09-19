'use strict';
// Project 2 Phase 4.6 - grounded pipeline. Not part of the package exports and not wired into any
// live product path; tools/sinbad-grounded-service.js hosts it on a loopback port for measurement.
// Owner delegation of 2026-09-19.
const pipeline=require('./grounded-pipeline');
const retriever=require('./lexical-retriever');
const authority=require('../authority');
const MANIFEST=Object.freeze({
  version:'sinbad-grounded-pipeline-component/0-v1',
  role:'GROUNDED_ANSWER_LOOP',
  status:'OFFLINE_RUNTIME_COMPONENT',
  // Unlike the inert components it drives, this one does call a model - through a function the host injects.
  callsModel:'INJECTED',
  performsIo:false,
  readsClock:false,
  keepsState:false,
  executes:false,
  approves:false,
  grantsAuthority:false,
  authority:'NONE',
  wiredInto:Object.freeze([]),
  contracts:authority.MANIFEST.version,
  modules:Object.freeze({pipeline:pipeline.VERSION,retriever:retriever.VERSION})
});
module.exports=Object.freeze({MANIFEST,pipeline,retriever});

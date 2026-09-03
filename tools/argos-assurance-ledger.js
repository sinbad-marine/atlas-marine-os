'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const shelfApi=require('../sinbad-ai-core/argos-event-shelf');const ledgerApi=require('../sinbad-ai-core/argos-operations-ledger');
const root=path.resolve(process.env.ARGOS_LEDGER_ROOT||path.join(__dirname,'..','.argos-runtime'));
const runId=String(process.env.ARGOS_RUN_ID||'').trim(),command=process.argv[2],at=new Date().toISOString();
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function fail(message){process.stderr.write(`ARGOS_ASSURANCE_LEDGER_FAILED: ${message}\n`);process.exitCode=1;}
try{fs.mkdirSync(root,{recursive:true});const shelf=shelfApi.create({root,shelfId:'assurance-runs',maxEvents:10000}),ledger=ledgerApi.create({shelf});let result;if(command==='start')result=ledger.startRun({runId,startedAt:at,scopeHash:hash(`${runId}:${process.env.ARGOS_SCOPE_REF||'LOCAL'}`)});else if(command==='finish'){const outcome=String(process.env.ARGOS_RUN_OUTCOME||'').toLowerCase()==='success'?'PASSED':'FAILED';result=ledger.finishRun({runId,finishedAt:at,outcome,evidenceHash:hash(`${runId}:${outcome}:${process.env.ARGOS_SCOPE_REF||'LOCAL'}`)});}else throw new Error('COMMAND_INVALID');if(result.status==='ARGOS_OPERATION_BLOCKED')throw new Error(result.reasonCode);const snapshot=ledger.snapshot();process.stdout.write(`${JSON.stringify({status:result.status,runId,headHash:snapshot.headHash,runs:snapshot.runs})}\n`);}catch(error){fail(error instanceof Error?error.message:'UNKNOWN');}

'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {observe,assess}=require('../sinbad-ai-core/argos-health-contracts');
const {probeGitHub,probeSupabase}=require('../sinbad-ai-core/argos-readonly-sensors');

const {recordHealth}=require('./argos-record-health');
const {probeArgosBridge}=require('./argos-bridge-status');
const {probeReleaseEvidence}=require('./argos-release-evidence');
const root=path.resolve(__dirname,'..');
const now=()=>new Date();
const boundedFetch=(url,options)=>globalThis.fetch(url,{...options,signal:AbortSignal.timeout(5000)});
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function localApplication(){const files=['index.html','app.js','sw.js','manifest.webmanifest'];const evidence=files.map(file=>{const bytes=fs.readFileSync(path.join(root,file));return {file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});const observedAt=now().toISOString();return observe({component:'APPLICATION',state:'UNKNOWN',observedAt,validUntil:new Date(Date.parse(observedAt)+300000).toISOString(),reasonCode:'APPLICATION_FUNCTIONAL_EVIDENCE_MISSING',evidenceHash:sha(evidence)});}
async function main(){const observations=[localApplication()];observations.push(await probeArgosBridge({fetcher:boundedFetch,clock:now}));if(process.env.ARGOS_GITHUB_OWNER&&process.env.ARGOS_GITHUB_REPO&&process.env.ARGOS_GITHUB_REF){observations.push(await probeGitHub({owner:process.env.ARGOS_GITHUB_OWNER,repo:process.env.ARGOS_GITHUB_REPO,ref:process.env.ARGOS_GITHUB_REF,token:process.env.ARGOS_GITHUB_TOKEN,fetch:boundedFetch,clock:now}));}if(process.env.ARGOS_GITHUB_OWNER&&process.env.ARGOS_GITHUB_REPO&&process.env.ARGOS_GITHUB_REF){observations.push(...await probeReleaseEvidence({owner:process.env.ARGOS_GITHUB_OWNER,repo:process.env.ARGOS_GITHUB_REPO,ref:process.env.ARGOS_GITHUB_REF,token:process.env.ARGOS_GITHUB_TOKEN,root,fetcher:boundedFetch,clock:now}));}if(process.env.ARGOS_SUPABASE_URL){observations.push(await probeSupabase({baseUrl:process.env.ARGOS_SUPABASE_URL,fetch:boundedFetch,clock:now}));}const assessedAt=now().toISOString();const report=assess(observations,assessedAt);const recording=process.argv.includes('--record')?recordHealth({root:path.resolve(process.env.ARGOS_HEALTH_LEDGER_ROOT||path.join(root,'.argos-runtime','health-runs')),observations,now:assessedAt}):null;process.stdout.write(`${JSON.stringify({status:report.status,reasonCode:report.reasonCode,partial:true,components:report.components,recording},null,2)}\n`);if(report.status!=='ARGOS_SYSTEM_HEALTHY')process.exitCode=1;}
main().catch(error=>{process.stderr.write(`ARGOS_HEALTH_RUN_FAILED: ${error instanceof Error?error.message:'UNKNOWN'}\n`);process.exitCode=1;});

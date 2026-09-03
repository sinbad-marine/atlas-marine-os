'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');

test('real health CLI rejects missing release evidence even when HTTP probes succeed', () => {
  const env = {...process.env};
  for (const name of Object.keys(env)) if (name.startsWith('ARGOS_')) delete env[name];
  const script = path.resolve(__dirname, '../tools/run-argos-health.js');
  const result = spawnSync(process.execPath, ['-e',
    `globalThis.fetch=async(url,options)=>{if(!options.signal)throw Error('Missing timeout');return {ok:true,status:200}};require(${JSON.stringify(script)})`],
    {env, encoding: 'utf8', timeout: 15000});
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'ARGOS_RELEASE_HEALTH_BLOCKED');
  assert.equal(report.components.find(item => item.component === 'BRIDGE').state, 'DEGRADED');
  for (const name of ['APPLICATION', 'TEST_SUITE', 'RELEASE_PIPELINE']) {
    assert.equal(report.components.find(item => item.component === name).state, 'UNKNOWN');
  }
});

test('health CLI fails closed for every nonhealthy assessment status', () => {
  const script = path.resolve(__dirname, '../tools/run-argos-health.js');
  const contracts = path.resolve(__dirname, '../sinbad-ai-core/argos-health-contracts.js');
  for (const status of ['ARGOS_HEALTH_BLOCKED', 'ARGOS_RELEASE_HEALTH_BLOCKED', 'ARGOS_SYSTEM_DEGRADED', 'UNRECOGNIZED', 'ARGOS_SYSTEM_HEALTHY']) {
    const result = spawnSync(process.execPath, ['-e',
      `const c=require(${JSON.stringify(contracts)});require.cache[require.resolve(${JSON.stringify(contracts)})].exports={...c,assess:()=>({status:${JSON.stringify(status)},components:[]})};globalThis.fetch=async()=>({ok:true,status:200});require(${JSON.stringify(script)})`],
      {encoding: 'utf8', timeout: 15000, env: {SystemRoot: process.env.SystemRoot}});
    assert.ifError(result.error);
    assert.equal(result.status, status === 'ARGOS_SYSTEM_HEALTHY' ? 0 : 1, result.stderr);
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');

test('actual PowerShell admission gate rejects missing stale mismatched and replayed envelopes without starting Bridge', {skip: process.platform !== 'win32'}, () => {
  const source = fs.readFileSync('bridge/sinbad-bridge.ps1', 'utf8');
  const start = source.indexOf("$script:ArgosBridgeCommandVersion =");
  const end = source.indexOf('function Invoke-LocalTextGet', start);
  assert.ok(start > 0 && end > start);
  const checks = `
$ErrorActionPreference='Stop'
function Expect-Reason($headers,$target,$reason) {
  $result=Test-ArgosBridgeCommand $headers $target
  if ($result.admitted -or $result.reason -ne $reason) { throw "Unexpected admission: $reason" }
}
Expect-Reason @{} '/ai/chat' 'ARGOS_COMMAND_BINDING_INVALID'
Expect-Reason @{} '/unregistered' 'ARGOS_TARGET_NOT_REGISTERED'
$headers=@{
 'x-sinbad-argos-version'='sinbad-argos-command/1-v1'
 'x-sinbad-argos-action'='AI_INFERENCE'
 'x-sinbad-argos-target'='/ai/chat'
 'x-sinbad-argos-command-id'='argos-runtime-check-001'
 'x-sinbad-argos-requested-at'=[DateTimeOffset]::UtcNow.AddMinutes(-6).ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
}
Expect-Reason $headers '/ai/chat' 'ARGOS_COMMAND_TIME_STALE'
$headers['x-sinbad-argos-requested-at']=[DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
Expect-Reason $headers '/routes' 'ARGOS_COMMAND_BINDING_INVALID'
if (-not (Test-ArgosBridgeCommand $headers '/ai/chat').admitted) { throw 'Valid envelope rejected' }
Expect-Reason $headers '/ai/chat' 'ARGOS_COMMAND_REPLAYED'
'ARGOS_ISOLATED_GATE_VERIFIED'
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(source.slice(start, end) + checks, 'utf16le').toString('base64')],
    {encoding: 'utf8', timeout: 20000, windowsHide: true});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ARGOS_ISOLATED_GATE_VERIFIED/);
});

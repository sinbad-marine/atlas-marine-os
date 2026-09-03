param(
 [Parameter(Mandatory=$true)][string]$PackageDirectory,
 [Parameter(Mandatory=$true)][string]$OwnerConfiguration,
 [Parameter(Mandatory=$true)][int]$ExpectedProcessId
)
$ErrorActionPreference='Stop'
$package=[IO.Path]::GetFullPath($PackageDirectory)
$manifest=Get-Content -LiteralPath (Join-Path $package 'BRIDGE-MANIFEST.json') -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 'sinbad-argos-bridge-package/1' -or $manifest.sourceState -ne 'CLEAN_COMMIT' -or $manifest.packageId -cnotmatch '^[0-9a-f]{64}$') { throw 'COMMITTED_BRIDGE_PACKAGE_REQUIRED' }
foreach($entry in $manifest.files){
 if ($entry.path -match '\.\.|^[/\\]|:' -or $entry.sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'PACKAGE_PATH_INVALID' }
 $source=Join-Path $package $entry.path
 if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'PACKAGE_LINK_REJECTED' }
 if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'PACKAGE_HASH_MISMATCH' }
}
$ownerConfig=Get-Content -LiteralPath $OwnerConfiguration -Raw | ConvertFrom-Json
if ($ownerConfig.schemaVersion -ne 'sinbad-argos-bridge-owner/1' -or $ownerConfig.projectUrl -cne 'https://kcvyftrvteqmabvxfebu.supabase.co') { throw 'OWNER_CONFIGURATION_INVALID' }
# Prove DPAPI can be opened by the same Windows identity, without printing it.
$secure=ConvertTo-SecureString -String $ownerConfig.protectedCredential
try { if ($secure.Length -ne 64) { throw 'OWNER_CREDENTIAL_INVALID' } } finally { $secure.Dispose() }
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$ExpectedProcessId"
if (-not $process -or $process.Name -ne 'powershell.exe' -or $process.CommandLine -notmatch '-File\s+"([^"]+sinbad-bridge\.ps1)"\s*$') { throw 'EXPECTED_BRIDGE_PROCESS_CHANGED' }
$oldScript=$Matches[1];$oldRoot=Split-Path -Parent (Split-Path -Parent $oldScript)
$listeners=@(Get-NetTCPConnection -LocalPort 31983 -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $ExpectedProcessId) { throw 'EXPECTED_BRIDGE_LISTENER_CHANGED' }
if (@(Get-NetTCPConnection -LocalPort 31983 -State Established -ErrorAction SilentlyContinue).Count) { throw 'BRIDGE_BUSY_RETRY_AFTER_CURRENT_REQUEST' }
$installRoot=Join-Path $env:LOCALAPPDATA 'Sinbad\argos'
$release=Join-Path $installRoot ('releases\'+$manifest.packageId)
$rollback=Join-Path $installRoot ('rollback\'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
if (Test-Path -LiteralPath $release) {
 foreach($entry in $manifest.files){$existing=Join-Path $release $entry.path;if((Test-Path -LiteralPath $existing) -and (Get-FileHash -LiteralPath $existing).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'EXISTING_RELEASE_HASH_MISMATCH'}}
}
New-Item -ItemType Directory -Path $release,$rollback -Force | Out-Null
foreach($entry in $manifest.files){
 $target=Join-Path $release $entry.path
 New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $package $entry.path) -Destination $target
 if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'INSTALLED_HASH_MISMATCH' }
 $previous=Join-Path $oldRoot $entry.path
 if(Test-Path -LiteralPath $previous -PathType Leaf){
  $backup=Join-Path $rollback $entry.path;New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
  Copy-Item -LiteralPath $previous -Destination $backup
  if((Get-FileHash -LiteralPath $backup).Hash -ne (Get-FileHash -LiteralPath $previous).Hash){throw 'ROLLBACK_HASH_MISMATCH'}
 }
}
Copy-Item -LiteralPath (Join-Path $package 'BRIDGE-MANIFEST.json') -Destination (Join-Path $release 'BRIDGE-MANIFEST.json')
$shortcutPath=Join-Path ([Environment]::GetFolderPath('Startup')) 'Sinbad Bridge.lnk'
if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) { throw 'EXPECTED_STARTUP_SHORTCUT_MISSING' }
Copy-Item -LiteralPath $shortcutPath -Destination (Join-Path $rollback 'Sinbad Bridge.lnk')
$configPath=Join-Path $installRoot 'bridge-owner.json'
$hadConfig=Test-Path -LiteralPath $configPath
if($hadConfig){Copy-Item -LiteralPath $configPath -Destination (Join-Path $rollback 'bridge-owner.json')}
$record=@{schemaVersion='sinbad-argos-bridge-cutover/1';oldProcessId=$ExpectedProcessId;oldScript=$oldScript;oldScriptSha256=(Get-FileHash -LiteralPath $oldScript).Hash.ToLowerInvariant();sourceCommit=$manifest.sourceCommit;packageId=$manifest.packageId;release=$release;rollback=$rollback;instanceId=$ownerConfig.instanceId;userData='Preserved in existing Documents/Sinbad Bridge and external runtime locations'}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $rollback 'CUTOVER.json') -Encoding UTF8
function Start-IndependentBridge([string]$executable,[string]$scriptPath){
 $startup=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
 $command='"'+$executable+'" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$scriptPath+'"'
 $launched=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$command;CurrentDirectory=(Split-Path -Parent $scriptPath);ProcessStartupInformation=$startup}
 if($launched.ReturnValue -ne 0){throw 'INDEPENDENT_BRIDGE_START_FAILED'}
 return Get-Process -Id $launched.ProcessId -ErrorAction Stop
}
$newProcess=$null
try {
 Copy-Item -LiteralPath $OwnerConfiguration -Destination $configPath -Force
 # Recheck identity and idle state immediately before the authorized cutover.
 $current=Get-CimInstance Win32_Process -Filter "ProcessId=$ExpectedProcessId"
 if ($current.CreationDate -ne $process.CreationDate -or $current.CommandLine -cne $process.CommandLine) { throw 'BRIDGE_PROCESS_REPLACED' }
 if (@(Get-NetTCPConnection -LocalPort 31983 -State Established -ErrorAction SilentlyContinue).Count) { throw 'BRIDGE_BUSY_RETRY_AFTER_CURRENT_REQUEST' }
 Stop-Process -Id $ExpectedProcessId
 Wait-Process -Id $ExpectedProcessId -Timeout 10 -ErrorAction SilentlyContinue
 $newScript=Join-Path $release 'bridge\sinbad-bridge.ps1'
 $newProcess=Start-IndependentBridge $process.ExecutablePath $newScript
 $ready=$false
 for($attempt=0;$attempt -lt 15;$attempt++){
  Start-Sleep -Milliseconds 500
  try { $status=Invoke-RestMethod -Uri 'http://127.0.0.1:31983/argos/status' -TimeoutSec 3
   if($status.ownerBoundary.enforced -and $status.ownerBoundary.configured -and $status.ownerBoundary.instanceId -ceq $ownerConfig.instanceId){$ready=$true;break}
  }catch{}
 }
 if (-not $ready) { throw 'NEW_BRIDGE_READINESS_FAILED' }
 $active=@(Get-NetTCPConnection -LocalPort 31983 -State Listen)
 if ($active.Count -ne 1 -or $active[0].OwningProcess -ne $newProcess.Id) { throw 'NEW_BRIDGE_LISTENER_MISMATCH' }
 $shell=New-Object -ComObject WScript.Shell;$shortcut=$shell.CreateShortcut($shortcutPath)
 $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\wscript.exe'
 $shortcut.Arguments='"'+(Join-Path $release 'bridge\start-sinbad-bridge-silent.vbs')+'"'
 $shortcut.WorkingDirectory=Join-Path $release 'bridge';$shortcut.Save()
 $record['status']='ACTIVATED';$record['newProcessId']=$newProcess.Id;$record['launchMethod']='WINDOWS_PROCESS_MANAGEMENT_HIDDEN'
 $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installRoot 'active-release.json') -Encoding UTF8
 $record | ConvertTo-Json -Compress
}catch{
 $failure=$_.Exception.Message
 if($newProcess -and -not $newProcess.HasExited){Stop-Process -Id $newProcess.Id -ErrorAction SilentlyContinue}
 Copy-Item -LiteralPath (Join-Path $rollback 'Sinbad Bridge.lnk') -Destination $shortcutPath -Force
 if($hadConfig){Copy-Item -LiteralPath (Join-Path $rollback 'bridge-owner.json') -Destination $configPath -Force}
 if(-not (Get-Process -Id $ExpectedProcessId -ErrorAction SilentlyContinue)){
  $restore=Join-Path $rollback 'bridge\sinbad-bridge.ps1'
  Start-IndependentBridge $process.ExecutablePath $restore | Out-Null
 }
 throw ('BRIDGE_CUTOVER_ROLLED_BACK: '+$failure)
}

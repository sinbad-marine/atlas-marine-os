param([Parameter(Mandatory=$true)][string]$ExpectedPackageId)
$ErrorActionPreference='Stop'
# Node may inherit PowerShell 7 module paths; use the executing Windows runtime.
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
if($ExpectedPackageId -cnotmatch '^[a-f0-9]{64}$'){throw 'EXPECTED_PACKAGE_REQUIRED'}
$root=Join-Path $env:LOCALAPPDATA ('Sinbad\argos\releases\'+$ExpectedPackageId)
$manifest=Get-Content -LiteralPath (Join-Path $root 'BRIDGE-MANIFEST.json') -Raw | ConvertFrom-Json
if($manifest.packageId -cne $ExpectedPackageId -or $manifest.sourceState -ne 'CLEAN_COMMIT'){throw 'PACKAGE_IDENTITY_INVALID'}
foreach($entry in $manifest.files){
 if($entry.path -match '\.\.|^[/\\]|:' -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'PACKAGE_ENTRY_INVALID'}
 $file=Join-Path $root $entry.path
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'PACKAGE_LINK_INVALID'}
 if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'RUNNING_SOURCE_HASH_MISMATCH'}
}
$listeners=@(Get-NetTCPConnection -LocalPort 31983 -State Listen -ErrorAction SilentlyContinue)
if($listeners.Count -ne 1){throw 'BRIDGE_LISTENER_UNAVAILABLE'}
$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listeners[0].OwningProcess)
if($process.Name -ne 'powershell.exe' -or $process.CommandLine -notmatch '-File\s+"([^"]+)"\s*$'){throw 'BRIDGE_PROCESS_INVALID'}
if([IO.Path]::GetFullPath($Matches[1]) -cne [IO.Path]::GetFullPath((Join-Path $root 'bridge\sinbad-bridge.ps1'))){throw 'BRIDGE_PROCESS_SOURCE_MISMATCH'}
$parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$process.ParentProcessId)
[ordered]@{status='ARGOS_HOST_IDENTITY_VERIFIED';processId=$process.ProcessId;startedAt=$process.CreationDate.ToUniversalTime().ToString('o');parentName=$parent.Name;packageId=$ExpectedPackageId;sourceCommit=$manifest.sourceCommit;files=$manifest.files} | ConvertTo-Json -Depth 4 -Compress

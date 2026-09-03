param([Parameter(Mandatory=$true)][ValidateSet('provision','verify')][string]$Command,[string]$ArchiveFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$root=Join-Path $env:LOCALAPPDATA 'SinbadMarine\Argos'
$keyFile=Join-Path $root 'ci-archive-key.dpapi'
$entropy=[Text.Encoding]::UTF8.GetBytes('sinbad-argos-ci-retention/1')
$key=$null
try {
 if($Command -eq 'provision'){
  $remote=(& gh secret list --repo sinbad-marine/atlas-marine-os --json name | ConvertFrom-Json)
  if($LASTEXITCODE -ne 0){throw 'REPOSITORY_SECRET_STATUS_FAILED'}
  if(@($remote | Where-Object name -eq 'ARGOS_ARCHIVE_KEY').Count -and -not (Test-Path -LiteralPath $keyFile)){throw 'EXISTING_REMOTE_KEY_REQUIRES_ITS_CUSTODIAN'}
  if(-not (Test-Path -LiteralPath $keyFile)){
   New-Item -ItemType Directory -Path $root -Force | Out-Null
   $key=[byte[]]::new(32);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($key)}finally{$rng.Dispose()}
   $sealed=[Security.Cryptography.ProtectedData]::Protect($key,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   $stream=[IO.File]::Open($keyFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$stream.Write($sealed,0,$sealed.Length);$stream.Flush($true)}finally{$stream.Dispose()}
  }else{$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)}
  if($key.Length -ne 32){throw 'RETENTION_KEY_INVALID'}
  # gh encrypts repository secrets; no secret is passed as a command argument.
  [Convert]::ToBase64String($key) | & gh secret set ARGOS_ARCHIVE_KEY --repo sinbad-marine/atlas-marine-os
  if($LASTEXITCODE -ne 0){throw 'RETENTION_SECRET_PROVISION_FAILED'}
  & gh variable set ARGOS_ARCHIVE_RETENTION_ENABLED --repo sinbad-marine/atlas-marine-os --body true
  if($LASTEXITCODE -ne 0){throw 'RETENTION_FLAG_PROVISION_FAILED'}
  Write-Output 'ARGOS_CI_RETENTION_PROVISIONED'
 }else{
  if(-not (Test-Path -LiteralPath $ArchiveFile -PathType Leaf)){throw 'ARCHIVE_FILE_REQUIRED'}
  $key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $env:ARGOS_ARCHIVE_KEY=[Convert]::ToBase64String($key)
  $env:ARGOS_ARCHIVE_ROOT=Split-Path -Parent ([IO.Path]::GetFullPath($ArchiveFile))
  & node (Join-Path $PSScriptRoot 'argos-encrypted-archive.js') verify ([IO.Path]::GetFullPath($ArchiveFile))
  if($LASTEXITCODE -ne 0){throw 'RETAINED_ARCHIVE_VERIFICATION_FAILED'}
 }
}finally{
 if($key){[Array]::Clear($key,0,$key.Length)}
 Remove-Item Env:\ARGOS_ARCHIVE_KEY -ErrorAction SilentlyContinue
 Remove-Item Env:\ARGOS_ARCHIVE_ROOT -ErrorAction SilentlyContinue
}

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('initialize', 'archive', 'verify', 'install-task', 'task-status', 'remove-task')]
  [string]$Command,
  [Parameter(Position = 1)]
  [string]$ArchiveFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$SecretRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'SinbadMarine\Argos'
$SecretFile = Join-Path $SecretRoot 'archive-key.dpapi'
$TaskName = 'SINBAD ARGOS Encrypted Archive'
$Entropy = [Text.Encoding]::UTF8.GetBytes('sinbad-argos-archive-key/1-v1')

function Write-Result([string]$Status, [string]$ReasonCode = '') {
  $result = [ordered]@{ version = 'sinbad-argos-windows-archive/1-v1'; status = $Status }
  if ($ReasonCode) { $result.reasonCode = $ReasonCode }
  $result | ConvertTo-Json -Compress | Write-Output
}

function Assert-SecretPath {
  if ([string]::IsNullOrWhiteSpace($SecretRoot) -or [string]::IsNullOrWhiteSpace($SecretFile)) {
    throw 'ARGOS_SECRET_PATH_INVALID'
  }
  if (Test-Path -LiteralPath $SecretRoot) {
    $rootItem = Get-Item -LiteralPath $SecretRoot -Force
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw 'ARGOS_SECRET_ROOT_INVALID'
    }
  }
}

function Protect-ArchiveKey([byte[]]$Key) {
  if ($Key.Length -ne 32) { throw 'ARGOS_ARCHIVE_KEY_INVALID' }
  [Security.Cryptography.ProtectedData]::Protect(
    $Key,
    $Entropy,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
}

function Read-ArchiveKey {
  Assert-SecretPath
  if (-not (Test-Path -LiteralPath $SecretFile -PathType Leaf)) { throw 'ARGOS_ARCHIVE_KEY_NOT_INITIALIZED' }
  $item = Get-Item -LiteralPath $SecretFile -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'ARGOS_SECRET_FILE_INVALID' }
  $protected = [IO.File]::ReadAllBytes($SecretFile)
  try {
    $key = [Security.Cryptography.ProtectedData]::Unprotect(
      $protected,
      $Entropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
  } catch {
    throw 'ARGOS_ARCHIVE_KEY_UNPROTECT_FAILED'
  }
  if ($key.Length -ne 32) { throw 'ARGOS_ARCHIVE_KEY_INVALID' }
  return $key
}

function Initialize-ArchiveKey {
  Assert-SecretPath
  if (Test-Path -LiteralPath $SecretFile) { throw 'ARGOS_ARCHIVE_KEY_ALREADY_INITIALIZED' }
  [IO.Directory]::CreateDirectory($SecretRoot) | Out-Null
  $key = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($key) } finally { $random.Dispose() }
  try {
    [byte[]]$protected = Protect-ArchiveKey $key
    $temporary = Join-Path $SecretRoot ('.archive-key-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    [IO.File]::WriteAllBytes($temporary, $protected)
    Move-Item -LiteralPath $temporary -Destination $SecretFile -ErrorAction Stop
    & icacls.exe $SecretRoot '/inheritance:r' '/grant:r' ('{0}:(OI)(CI)F' -f [Environment]::UserName) '/grant:r' 'SYSTEM:(OI)(CI)F' | Out-Null
    Write-Result 'ARGOS_ARCHIVE_KEY_INITIALIZED'
  } finally {
    [Array]::Clear($key, 0, $key.Length)
  }
}

function Invoke-Archive([string[]]$Arguments) {
  $key = Read-ArchiveKey
  try {
    $env:ARGOS_ARCHIVE_KEY = [Convert]::ToBase64String($key)
    & node (Join-Path $ProjectRoot 'tools\argos-encrypted-archive.js') @Arguments
    if ($LASTEXITCODE -ne 0) { throw "ARGOS_ARCHIVE_PROCESS_FAILED_$LASTEXITCODE" }
  } finally {
    Remove-Item Env:\ARGOS_ARCHIVE_KEY -ErrorAction SilentlyContinue
    [Array]::Clear($key, 0, $key.Length)
  }
}

function Install-ArchiveTask {
  if (-not (Test-Path -LiteralPath $SecretFile -PathType Leaf)) { throw 'ARGOS_ARCHIVE_KEY_NOT_INITIALIZED' }
  $scriptPath = [IO.Path]::GetFullPath($PSCommandPath)
  $action = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" archive' -f $scriptPath) -WorkingDirectory $ProjectRoot
  $triggers = @(0, 6, 12, 18) | ForEach-Object {
    New-ScheduledTaskTrigger -Daily -At ((Get-Date).Date.AddHours($_).AddMinutes(15))
  }
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Creates a local encrypted ARGOS event-shelf archive every six hours. No network, publish, deploy, or cloud mutation.' -Force | Out-Null
  Write-Result 'ARGOS_ARCHIVE_TASK_INSTALLED'
}

try {
  switch ($Command) {
    'initialize' { Initialize-ArchiveKey }
    'archive' { Invoke-Archive @('create') }
    'verify' {
      if ([string]::IsNullOrWhiteSpace($ArchiveFile)) { throw 'ARCHIVE_FILE_REQUIRED' }
      Invoke-Archive @('verify', $ArchiveFile)
    }
    'install-task' { Install-ArchiveTask }
    'task-status' {
      $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
      if ($null -eq $task) { Write-Result 'ARGOS_ARCHIVE_TASK_NOT_INSTALLED' }
      else { Write-Result ('ARGOS_ARCHIVE_TASK_' + $task.State.ToString().ToUpperInvariant()) }
    }
    'remove-task' {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
      Write-Result 'ARGOS_ARCHIVE_TASK_REMOVED'
    }
  }
} catch {
  $reason = if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $_.Exception.Message } else { 'ARGOS_WINDOWS_ARCHIVE_FAILED' }
  Write-Result 'ARGOS_WINDOWS_ARCHIVE_BLOCKED' $reason | Write-Error
  exit 1
}

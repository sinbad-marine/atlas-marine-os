$ErrorActionPreference = 'Stop'

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'Sinbad Bridge.lnk'
$launcherPath = Join-Path $PSScriptRoot 'start-sinbad-bridge-silent.vbs'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Bridge launcher not found: $launcherPath"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
$shortcut.Arguments = '"' + $launcherPath + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'Start Sinbad Bridge when Windows signs in'
$shortcut.Save()

Write-Host 'Sinbad Bridge automatic startup is installed.' -ForegroundColor Green
Write-Host "Shortcut: $shortcutPath"


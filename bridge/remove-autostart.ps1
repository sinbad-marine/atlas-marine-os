$ErrorActionPreference = 'Stop'

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Sinbad Bridge.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
  Write-Host 'Sinbad Bridge automatic startup was removed.' -ForegroundColor Yellow
} else {
  Write-Host 'Sinbad Bridge automatic startup was not installed.'
}


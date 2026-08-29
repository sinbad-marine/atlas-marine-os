param(
  [int]$Port = 31983,
  [string]$ExchangeRoot = '',
  [string]$AiModel = 'qwen3:14b',
  # The installed qwen3:4b template can exhaust its budget without emitting a
  # final answer. The verified 14B model serves both tiers on this installation.
  [string]$FastAiModel = 'qwen3:14b',
  [string]$XttsExecutable = '',
  [string]$XttsModelPath = '',
  [string]$XttsConfigPath = '',
  [string]$XttsSpeakerWav = '',
  [string]$OpenCpnExecutable = '',
  [int]$XttsWorkerPort = 31984,
  [string]$KiwixUrl = 'http://127.0.0.1:8181',
  [string]$VisualAtlasRoot = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.Drawing
if (-not ('SinbadNativeWindow' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SinbadNativeWindow {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
}
'@
}
$tierRouterPath = Join-Path $PSScriptRoot 'qwen-tier-router.ps1'
if (-not (Test-Path -LiteralPath $tierRouterPath -PathType Leaf)) { throw 'SINBAD_QWEN_TIER_ROUTER_MISSING' }
. $tierRouterPath
$bridgeRoot = if ([string]::IsNullOrWhiteSpace($ExchangeRoot)) { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sinbad Bridge' } else { $ExchangeRoot }
$routeRoot = Join-Path $bridgeRoot 'Routes'
$libraryRoot = Join-Path $bridgeRoot 'Library'
$importRoot = Join-Path $libraryRoot 'Imported'
$indexPath = Join-Path $libraryRoot '.sinbad-index.json'
$visualAtlasCandidates = @(
  $(if (-not [string]::IsNullOrWhiteSpace($VisualAtlasRoot)) { $VisualAtlasRoot }),
  (Join-Path $env:USERPROFILE 'Documents\Sinbad Visual Library'),
  (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sinbad Visual Library')
) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique
$visualAtlasRoot = @($visualAtlasCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'catalog.sqlite') } | Select-Object -First 1)[0]
if ([string]::IsNullOrWhiteSpace([string]$visualAtlasRoot)) { $visualAtlasRoot = [string]$visualAtlasCandidates[0] }
$visualQueryScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\sinbad-ai-core\visual-library\scripts\query-complete-library-atlas.py'))
$userProfileRoot = [Environment]::GetFolderPath('UserProfile')
if ([string]::IsNullOrWhiteSpace($userProfileRoot)) { $userProfileRoot = [Environment]::GetEnvironmentVariable('USERPROFILE') }
if ([string]::IsNullOrWhiteSpace($userProfileRoot)) { throw 'SINBAD_USER_PROFILE_UNAVAILABLE' }
if ([string]::IsNullOrWhiteSpace($XttsExecutable)) { $XttsExecutable = Join-Path $userProfileRoot 'AppData\Local\Programs\Python\Python311\Scripts\tts.exe' }
if ([string]::IsNullOrWhiteSpace($XttsModelPath)) { $XttsModelPath = Join-Path $userProfileRoot 'xtts_v2_model' }
if ([string]::IsNullOrWhiteSpace($XttsConfigPath)) { $XttsConfigPath = Join-Path $XttsModelPath 'config.json' }
if ([string]::IsNullOrWhiteSpace($XttsSpeakerWav)) { $XttsSpeakerWav = Join-Path $userProfileRoot 'yasemin_sesi.wav' }
if ([string]::IsNullOrWhiteSpace($OpenCpnExecutable)) {
  $OpenCpnExecutable = @(
    (Join-Path ${env:ProgramFiles(x86)} 'OpenCPN\opencpn.exe'),
    (Join-Path $env:ProgramFiles 'OpenCPN\opencpn.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}
$xttsPython = Join-Path (Split-Path -Parent (Split-Path -Parent $XttsExecutable)) 'python.exe'
$isolatedXttsPython = Join-Path $env:LOCALAPPDATA 'Sinbad\xtts-venv\Scripts\python.exe'
if (Test-Path -LiteralPath $isolatedXttsPython -PathType Leaf) { $xttsPython = $isolatedXttsPython }
$xttsWorkerScript = Join-Path $PSScriptRoot 'xtts-worker.py'
$xttsWorkerUrl = "http://127.0.0.1:$XttsWorkerPort"
$voiceTempRoot = Join-Path $bridgeRoot 'Voice\Temp'
$openCpnConfigPath = Join-Path $env:ProgramData 'opencpn\opencpn.ini'
$openCpnRestClientPath = Join-Path $PSScriptRoot 'opencpn-rest-client.js'
$script:XttsBusy = $false
New-Item -ItemType Directory -Force -Path $routeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $libraryRoot | Out-Null
New-Item -ItemType Directory -Force -Path $importRoot | Out-Null
New-Item -ItemType Directory -Force -Path $voiceTempRoot | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Sinbad Bridge is online: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "GPX exchange folder: $routeRoot"
Write-Host "Offline library folder: $libraryRoot"
Write-Host "Offline AI models: fast=$FastAiModel deep=$AiModel"
Write-Host "Offline world knowledge: $KiwixUrl"
Write-Host "XTTS persistent worker: http://127.0.0.1:$XttsWorkerPort"
Write-Host 'Keep this window open while using the Bridge. Press Ctrl+C to stop.'

function Invoke-LocalJsonGet([string]$uri) {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = 'curl.exe'
  $info.Arguments = "--noproxy * --silent --show-error --max-time 8 $uri"
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($info)
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Local service request failed: $errorText" }
  return ($output | ConvertFrom-Json)
}

$script:ResponseOrigin = 'https://sinbad-marine.github.io'
function Test-AllowedBrowserOrigin([string]$origin) {
  return [string]::IsNullOrWhiteSpace($origin) -or
    $origin -eq 'https://sinbad-marine.github.io' -or
    $origin -match '^http://(?:127\.0\.0\.1|localhost):\d{2,5}$'
}

function Invoke-LocalTextGet([string]$uri, [int]$timeoutSeconds = 8) {
  $parsed = [Uri]$uri
  if ($parsed.Scheme -ne 'http' -or $parsed.Host -notin @('127.0.0.1','localhost')) { throw 'LOCAL_KNOWLEDGE_ENDPOINT_DENIED' }
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = 'curl.exe'
  $info.ArgumentList.Add('--noproxy'); $info.ArgumentList.Add('*')
  $info.ArgumentList.Add('--silent'); $info.ArgumentList.Add('--show-error')
  $info.ArgumentList.Add('--max-time'); $info.ArgumentList.Add([string]$timeoutSeconds)
  $info.ArgumentList.Add($uri)
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = [Text.Encoding]::UTF8
  $process = [Diagnostics.Process]::Start($info)
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Local knowledge request failed: $errorText" }
  return $output
}

function Invoke-LocalJsonPost([string]$uri, [string]$json) {
  $parsed = [Uri]$uri
  if ($parsed.Scheme -ne 'http' -or $parsed.Host -notin @('127.0.0.1','localhost')) { throw 'LOCAL_AI_ENDPOINT_DENIED' }
  $client = [Net.Http.HttpClient]::new()
  try {
    $client.Timeout = [TimeSpan]::FromSeconds(600)
    $content = [Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
    $response = $client.PostAsync($parsed, $content).GetAwaiter().GetResult()
    $output = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "Local AI request failed (HTTP $([int]$response.StatusCode)): $output" }
    return ($output | ConvertFrom-Json)
  } finally {
    if ($content) { $content.Dispose() }
    $client.Dispose()
  }
}

function Write-HttpResponse($stream, [int]$status, [string]$statusText, [string]$body, [string]$contentType = 'application/json; charset=utf-8') {
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($body)
  $headers = @(
    "HTTP/1.1 $status $statusText"
    "Content-Type: $contentType"
    "Content-Length: $($bodyBytes.Length)"
    "Access-Control-Allow-Origin: $script:ResponseOrigin"
    'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    'Access-Control-Allow-Headers: Content-Type'
    'Access-Control-Allow-Private-Network: true'
    'Cache-Control: no-store'
    'Connection: close'
    ''
    ''
  ) -join "`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  try {
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($bodyBytes.Length) { $stream.Write($bodyBytes, 0, $bodyBytes.Length) }
    $stream.Flush()
  } catch [IO.IOException] {
    # The browser/client may time out or close the socket before a long AI
    # response is ready. That must not stop the local Bridge service.
  } catch [ObjectDisposedException] {
    # The client disconnected while the response was being written.
  }
}

function Write-HttpBytes($stream, [int]$status, [string]$statusText, [byte[]]$bodyBytes, [string]$contentType) {
  $headers = @(
    "HTTP/1.1 $status $statusText"
    "Content-Type: $contentType"
    "Content-Length: $($bodyBytes.Length)"
    "Access-Control-Allow-Origin: $script:ResponseOrigin"
    'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    'Access-Control-Allow-Headers: Content-Type'
    'Access-Control-Allow-Private-Network: true'
    'Cache-Control: no-store'
    'X-Content-Type-Options: nosniff'
    'Connection: close'
    ''
    ''
  ) -join "`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  try {
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    $stream.Flush()
  } catch [IO.IOException] {
    # The browser may close during batch synthesis.
  } catch [ObjectDisposedException] {
    # The client disconnected.
  }
}

function Get-StudioCapabilityStatus {
  $dockerPath = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
  $dockerInstalled = Test-Path -LiteralPath $dockerPath
  $dockerRunning = [bool](Get-Process -Name 'com.docker.backend' -ErrorAction SilentlyContinue | Select-Object -First 1)
  $wslInstalled = Test-Path -LiteralPath (Join-Path $env:SystemRoot 'System32\wsl.exe')
  $studioManifest = Join-Path $PSScriptRoot '..\sinbad-ai-core\engines\studio\studio-pro-04-acceptance-manifest.js'
  $coreInstalled = Test-Path -LiteralPath $studioManifest
  $ready = $dockerInstalled -and $dockerRunning -and $wslInstalled -and $coreInstalled
  return @{
    status = if ($ready) { 'READY_FOR_APPROVAL_GATED_TESTS' } else { 'STUDIO_RUNTIME_INCOMPLETE' }
    studioVersion = '0.4.3'
    docker = @{ installed=$dockerInstalled; processRunning=$dockerRunning }
    wsl = @{ installed=$wslInstalled }
    core = @{ installed=$coreInstalled }
    allowed = @('VERIFIED_SOFTWARE_TESTS_ONLY','READ_ONLY_EVIDENCE_VERIFICATION')
    prohibited = @('GENERAL_COMMAND_EXECUTION','NETWORK_ACCESS','HOST_OR_CORE_WRITE','AUTOMATIC_MERGE','LIVE_PUBLISH')
    approval = 'EXACT_SINGLE_USE_APPROVAL_REQUIRED'
  }
}

function Get-OpenCpnWindowStatus {
  $process = Get-Process -Name 'opencpn' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  $installed = -not [string]::IsNullOrWhiteSpace([string]$OpenCpnExecutable) -and (Test-Path -LiteralPath $OpenCpnExecutable -PathType Leaf)
  if (-not $process) { return @{ installed=$installed; running=$false; minimized=$false; title=''; pid=$null } }
  $process.Refresh()
  return @{ installed=$installed; running=$true; minimized=[SinbadNativeWindow]::IsIconic($process.MainWindowHandle); title=$process.MainWindowTitle; pid=$process.Id }
}

function Start-OpenCpnWindow {
  $state = Get-OpenCpnWindowStatus
  if ($state.running) {
    $process = Get-Process -Id $state.pid -ErrorAction Stop
    if ($state.minimized) { $null = [SinbadNativeWindow]::ShowWindowAsync($process.MainWindowHandle,9) }
    return Get-OpenCpnWindowStatus
  }
  if ([string]::IsNullOrWhiteSpace([string]$OpenCpnExecutable) -or -not (Test-Path -LiteralPath $OpenCpnExecutable -PathType Leaf)) { throw 'OPENCPN_NOT_INSTALLED' }
  Start-Process -FilePath $OpenCpnExecutable | Out-Null
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 250
    $state = Get-OpenCpnWindowStatus
    if ($state.running) { return $state }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'OPENCPN_START_TIMEOUT'
}

function ConvertTo-NormalizedOpenCpnCoordinate($value,[string]$name) {
  $number = 0.0
  if (-not [double]::TryParse(([string]$value),[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$number)) { throw "OPENCPN_INPUT_INVALID_$name" }
  if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or $number -lt 0 -or $number -gt 1) { throw "OPENCPN_INPUT_INVALID_$name" }
  return $number
}

function Send-OpenCpnWindowInput($payload) {
  $allowed = @('click','rightClick','middleClick','doubleClick','drag','wheel','text','key','shortcut')
  $action = [string]$payload.action
  if ($allowed -notcontains $action) { throw 'OPENCPN_INPUT_ACTION_DENIED' }
  $process = Get-Process -Name 'opencpn' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $process) { throw 'OPENCPN_NOT_RUNNING' }
  $process.Refresh(); $handle = $process.MainWindowHandle
  if ([SinbadNativeWindow]::IsIconic($handle)) { throw 'OPENCPN_WINDOW_MINIMIZED' }
  if ($action -eq 'text') {
    $text=[string]$payload.text
    if ([string]::IsNullOrEmpty($text) -or $text.Length -gt 16 -or $text -match '[\x00-\x08\x0B\x0C\x0E-\x1F]') { throw 'OPENCPN_INPUT_TEXT_DENIED' }
    foreach ($character in $text.ToCharArray()) { if (-not [SinbadNativeWindow]::PostMessage($handle,0x0102,[UIntPtr][uint16]$character,[IntPtr]::Zero)) { throw 'OPENCPN_INPUT_DISPATCH_FAILED' } }
    return @{ ok=$true; action=$action; pid=$process.Id }
  }
  if ($action -eq 'key' -or $action -eq 'shortcut') {
    $virtualKeys=@{ Enter=0x0D; Escape=0x1B; Backspace=0x08; Delete=0x2E; Tab=0x09; Space=0x20; ArrowLeft=0x25; ArrowUp=0x26; ArrowRight=0x27; ArrowDown=0x28; Home=0x24; End=0x23; PageUp=0x21; PageDown=0x22; Insert=0x2D; F1=0x70; F2=0x71; F3=0x72; F4=0x73; F5=0x74; F6=0x75; F7=0x76; F8=0x77; F9=0x78; F10=0x79; F11=0x7A; F12=0x7B }
    $key=[string]$payload.key
    if ($action -eq 'shortcut') {
      if ($key -notmatch '^[A-Za-z]$') { throw 'OPENCPN_INPUT_SHORTCUT_DENIED' }
      $virtualKeys[$key]=[byte][char]$key.ToUpperInvariant()
      $null=[SinbadNativeWindow]::PostMessage($handle,0x0100,[UIntPtr]0x11,[IntPtr]::Zero)
    }
    if (-not $virtualKeys.ContainsKey($key)) { throw 'OPENCPN_INPUT_KEY_DENIED' }
    $vk=[UIntPtr][uint32]$virtualKeys[$key]
    if (-not [SinbadNativeWindow]::PostMessage($handle,0x0100,$vk,[IntPtr]::Zero) -or -not [SinbadNativeWindow]::PostMessage($handle,0x0101,$vk,[IntPtr]::Zero)) { throw 'OPENCPN_INPUT_DISPATCH_FAILED' }
    if ($action -eq 'shortcut') { $null=[SinbadNativeWindow]::PostMessage($handle,0x0101,[UIntPtr]0x11,[IntPtr]::Zero) }
    return @{ ok=$true; action=$action; pid=$process.Id }
  }
  $windowRect = [SinbadNativeWindow+RECT]::new(); $clientRect = [SinbadNativeWindow+RECT]::new(); $clientOrigin = [SinbadNativeWindow+POINT]::new()
  if (-not [SinbadNativeWindow]::GetWindowRect($handle,[ref]$windowRect) -or -not [SinbadNativeWindow]::GetClientRect($handle,[ref]$clientRect) -or -not [SinbadNativeWindow]::ClientToScreen($handle,[ref]$clientOrigin)) { throw 'OPENCPN_WINDOW_BOUNDS_UNAVAILABLE' }
  $windowWidth=$windowRect.Right-$windowRect.Left; $windowHeight=$windowRect.Bottom-$windowRect.Top; $clientWidth=$clientRect.Right; $clientHeight=$clientRect.Bottom
  if ($windowWidth -lt 320 -or $windowHeight -lt 240 -or $clientWidth -lt 1 -or $clientHeight -lt 1) { throw 'OPENCPN_WINDOW_BOUNDS_INVALID' }
  $toPoint = {
    param($nx,$ny)
    $px=[Math]::Round((ConvertTo-NormalizedOpenCpnCoordinate $nx 'X')*($windowWidth-1))-($clientOrigin.X-$windowRect.Left)
    $py=[Math]::Round((ConvertTo-NormalizedOpenCpnCoordinate $ny 'Y')*($windowHeight-1))-($clientOrigin.Y-$windowRect.Top)
    if ($px -lt 0 -or $py -lt 0 -or $px -ge $clientWidth -or $py -ge $clientHeight) { throw 'OPENCPN_INPUT_OUTSIDE_CLIENT' }
    return @{ x=[int]$px; y=[int]$py }
  }
  $pack = { param($point) [IntPtr](($point.y -shl 16) -bor ($point.x -band 0xffff)) }
  $post = { param([uint32]$message,[UIntPtr]$flags,[IntPtr]$location) if (-not [SinbadNativeWindow]::PostMessage($handle,$message,$flags,$location)) { throw 'OPENCPN_INPUT_DISPATCH_FAILED' } }
  $start = & $toPoint $payload.x $payload.y; $startLocation = & $pack $start
  if ($action -eq 'click') { & $post 0x0201 ([UIntPtr]1) $startLocation; & $post 0x0202 ([UIntPtr]0) $startLocation }
  elseif ($action -eq 'rightClick') { & $post 0x0204 ([UIntPtr]2) $startLocation; & $post 0x0205 ([UIntPtr]0) $startLocation }
  elseif ($action -eq 'middleClick') { & $post 0x0207 ([UIntPtr]0x10) $startLocation; & $post 0x0208 ([UIntPtr]0) $startLocation }
  elseif ($action -eq 'doubleClick') {
    & $post 0x0201 ([UIntPtr]1) $startLocation; & $post 0x0202 ([UIntPtr]0) $startLocation
    & $post 0x0203 ([UIntPtr]1) $startLocation; & $post 0x0202 ([UIntPtr]0) $startLocation
  } elseif ($action -eq 'drag') {
    $finish = & $toPoint $payload.x2 $payload.y2
    & $post 0x0201 ([UIntPtr]1) $startLocation
    1..8 | ForEach-Object { $ratio=$_/8; $step=@{x=[int][Math]::Round($start.x+($finish.x-$start.x)*$ratio);y=[int][Math]::Round($start.y+($finish.y-$start.y)*$ratio)}; & $post 0x0200 ([UIntPtr]1) (& $pack $step) }
    & $post 0x0202 ([UIntPtr]0) (& $pack $finish)
  } else {
    $steps=[Math]::Max(-3,[Math]::Min(3,[int]$payload.steps)); if ($steps -eq 0) { throw 'OPENCPN_INPUT_INVALID_WHEEL' }
    $screenX=$windowRect.Left+[Math]::Round((ConvertTo-NormalizedOpenCpnCoordinate $payload.x 'X')*($windowWidth-1)); $screenY=$windowRect.Top+[Math]::Round((ConvertTo-NormalizedOpenCpnCoordinate $payload.y 'Y')*($windowHeight-1))
    $screenLocation=[IntPtr](($screenY -shl 16) -bor ($screenX -band 0xffff)); $wheelValue=[uint32](([int16](120*$steps)) -shl 16)
    & $post 0x020A ([UIntPtr]$wheelValue) $screenLocation
  }
  return @{ ok=$true; action=$action; pid=$process.Id }
}

function Get-OpenCpnWindowFrame {
  $process = Get-Process -Name 'opencpn' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $process) { throw 'OPENCPN_NOT_RUNNING' }
  $process.Refresh()
  if ([SinbadNativeWindow]::IsIconic($process.MainWindowHandle)) { throw 'OPENCPN_WINDOW_MINIMIZED' }
  $rect = [SinbadNativeWindow+RECT]::new()
  if (-not [SinbadNativeWindow]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) { throw 'OPENCPN_WINDOW_BOUNDS_UNAVAILABLE' }
  $width = $rect.Right-$rect.Left; $height = $rect.Bottom-$rect.Top
  if ($width -lt 320 -or $height -lt 240 -or $width -gt 7680 -or $height -gt 4320) { throw 'OPENCPN_WINDOW_BOUNDS_INVALID' }
  $bitmap = [Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $stream = [IO.MemoryStream]::new()
  try {
    $hdc = $graphics.GetHdc()
    try { $captured = [SinbadNativeWindow]::PrintWindow($process.MainWindowHandle,$hdc,2) } finally { $graphics.ReleaseHdc($hdc) }
    if (-not $captured) { throw 'OPENCPN_WINDOW_CAPTURE_FAILED' }
    $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}

function Json($value) { return ($value | ConvertTo-Json -Depth 8 -Compress) }

function Invoke-VisualAtlasHelper([string[]]$arguments) {
  if (-not (Test-Path -LiteralPath (Join-Path $visualAtlasRoot 'catalog.sqlite'))) { throw 'Visual atlas catalogue is unavailable.' }
  if (-not (Test-Path -LiteralPath $visualQueryScript)) { throw 'Visual atlas query helper is unavailable.' }
  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  if (-not $python) { throw 'Python is required for visual atlas queries.' }
  $quoted = @("`"$visualQueryScript`"", '--atlas', "`"$visualAtlasRoot`"") + $arguments
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $python.Source
  $info.Arguments = ($quoted -join ' ')
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = [Text.Encoding]::UTF8
  $process = [Diagnostics.Process]::Start($info)
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  if (-not $process.WaitForExit(15000)) { try { $process.Kill() } catch {}; throw 'Visual atlas query timed out.' }
  if ($process.ExitCode -ne 0) { throw "Visual atlas query failed: $errorText" }
  return ($output | ConvertFrom-Json)
}

function Search-VisualAtlas($payload) {
  # Visual intent belongs to the user's question. The generated answer contains
  # broad explanatory vocabulary that can drown the requested object in FTS.
  $text = ([string]$payload.query).Trim()
  if ([string]::IsNullOrWhiteSpace($text)) { $text = ([string]$payload.answer).Trim() }
  if ([string]::IsNullOrWhiteSpace($text)) { throw 'A visual search query is required.' }
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))
  $limit = [Math]::Max(1, [Math]::Min(3, [int]$payload.limit))
  return Invoke-VisualAtlasHelper @('--query-base64', $encoded, '--limit', [string]$limit, '--object-only')
}

function Get-OpenCpnRestKey {
  if (-not (Test-Path -LiteralPath $openCpnConfigPath -PathType Leaf)) { return '' }
  $match = [regex]::Match([IO.File]::ReadAllText($openCpnConfigPath), '(?m)^ServerKeys=.*(?:^|;)SINBAD-BRIDGE:([^;\r\n]+)')
  if (-not $match.Success) { $match = [regex]::Match([IO.File]::ReadAllText($openCpnConfigPath), '(?m)^ServerKeys=SINBAD-BRIDGE:([^;\r\n]+)') }
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return ''
}

function Send-RouteToOpenCpn([string]$gpx) {
  $key = Get-OpenCpnRestKey
  if ([string]::IsNullOrWhiteSpace($key)) { return @{ imported=$false; reason='OPENCPN_PAIRING_REQUIRED' } }
  if (-not (Test-Path -LiteralPath $openCpnRestClientPath -PathType Leaf)) { return @{ imported=$false; reason='OPENCPN_REST_CLIENT_MISSING' } }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { return @{ imported=$false; reason='NODE_NOT_INSTALLED' } }
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $node.Source
  $info.Arguments = ('"{0}"' -f $openCpnRestClientPath.Replace('"',''))
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($info)
  $process.StandardInput.Write((Json @{ action='upload'; key=$key; gpx=$gpx }))
  $process.StandardInput.Close()
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { return @{ imported=$false; reason='OPENCPN_REST_FAILED'; detail=$errorText } }
  try {
    $wire = $output | ConvertFrom-Json
    $result = ([string]$wire.body | ConvertFrom-Json)
    if ([int]$wire.statusCode -eq 200 -and [int]$result.result -eq 0) { return @{ imported=$true; reason='OK' } }
    return @{ imported=$false; reason='OPENCPN_REJECTED'; result=$result.result }
  } catch { return @{ imported=$false; reason='OPENCPN_INVALID_RESPONSE' } }
}

function Get-OllamaStatus {
  try {
    $tags = Invoke-LocalJsonGet 'http://127.0.0.1:11434/api/tags'
    $models = @($tags.models | ForEach-Object { $_.name })
    return @{ online=$true; model=$AiModel; installed=($models -contains $AiModel); models=$models; routing=@{ fast=$FastAiModel; deep=$AiModel; fastInstalled=($models -contains $FastAiModel); deepInstalled=($models -contains $AiModel) } }
  } catch {
    return @{ online=$false; model=$AiModel; installed=$false; models=@(); routing=@{ fast=$FastAiModel; deep=$AiModel; fastInstalled=$false; deepInstalled=$false } }
  }
}

function Get-XttsStatus {
  $configured = (Test-Path -LiteralPath $xttsPython -PathType Leaf) -and
    (Test-Path -LiteralPath $XttsModelPath -PathType Container) -and
    (Test-Path -LiteralPath $XttsConfigPath -PathType Leaf) -and
    (Test-Path -LiteralPath $XttsSpeakerWav -PathType Leaf) -and
    (Test-Path -LiteralPath $xttsWorkerScript -PathType Leaf)
  if (-not $configured) { return @{ online=$false; state='not-configured'; engine='coqui-xtts-v2-persistent'; profile='owner-local'; language='tr'; busy=$false; latencyClass='sentence-stream' } }
  try {
    $worker = Invoke-LocalJsonGet "$xttsWorkerUrl/status"
    return @{ online=[bool]$worker.ready; state=[string]$worker.state; engine='coqui-xtts-v2-persistent'; profile='owner-local'; language='tr'; busy=[bool]$worker.busy; latencyClass='sentence-stream'; loadSeconds=$worker.loadSeconds; lastSynthesisSeconds=$worker.lastSynthesisSeconds; speakerDigest=$worker.speakerDigest }
  } catch {
    return @{ online=$false; state='worker-offline'; engine='coqui-xtts-v2-persistent'; profile='owner-local'; language='tr'; busy=$false; latencyClass='sentence-stream' }
  }
}

function Start-XttsWorkerIfNeeded {
  $status = Get-XttsStatus
  if ($status.state -ne 'worker-offline') { return $status }
  $arguments = @(
    $xttsWorkerScript,
    '--model-path', $XttsModelPath,
    '--config-path', $XttsConfigPath,
    '--speaker-wav', $XttsSpeakerWav,
    '--port', [string]$XttsWorkerPort
  )
  Start-Process -FilePath $xttsPython -ArgumentList $arguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden | Out-Null
  return @{ online=$false; state='starting'; engine='coqui-xtts-v2-persistent'; profile='owner-local'; language='tr'; busy=$false; latencyClass='sentence-stream' }
}

function Invoke-XttsVoice($payload) {
  if ($script:XttsBusy) { throw 'XTTS_BUSY' }
  $status = Get-XttsStatus
  if (-not $status.online) { throw 'XTTS_NOT_CONFIGURED' }
  $text = [string]$payload.text
  if ([string]::IsNullOrWhiteSpace($text)) { throw 'XTTS_TEXT_REQUIRED' }
  $text = [regex]::Replace($text, '[\x00-\x08\x0B\x0C\x0E-\x1F]', '').Trim()
  if ($text.Length -gt 800) { throw 'XTTS_TEXT_TOO_LONG' }
  $requestedLanguage = [string]$payload.language
  $language = switch -Regex ($requestedLanguage) {
    '^tr' { 'tr'; break }
    '^en' { 'en'; break }
    '^de' { 'de'; break }
    '^fr' { 'fr'; break }
    '^es' { 'es'; break }
    '^it' { 'it'; break }
    default { 'tr' }
  }
  $script:XttsBusy = $true
  try {
    $client = [Net.Http.HttpClient]::new()
    try {
      $client.Timeout = [TimeSpan]::FromSeconds(150)
      $json = @{ text=$text; language=$language } | ConvertTo-Json -Compress
      $content = [Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
      $response = $client.PostAsync("$xttsWorkerUrl/synthesize", $content).GetAwaiter().GetResult()
      if (-not $response.IsSuccessStatusCode) {
        $workerError = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        throw "XTTS_WORKER_FAILED: $workerError"
      }
      $audio = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    } finally {
      $client.Dispose()
    }
    if ($audio.Length -lt 44 -or [Text.Encoding]::ASCII.GetString($audio, 0, 4) -ne 'RIFF' -or
        [Text.Encoding]::ASCII.GetString($audio, 8, 4) -ne 'WAVE') { throw 'XTTS_INVALID_WAV' }
    return $audio
  } finally {
    $script:XttsBusy = $false
  }
}

function Convert-ToLibraryText($file) {
  $ext = $file.Extension.ToLowerInvariant()
  if ($ext -in '.txt','.md','.csv','.json','.xml','.html','.htm','.log','.yaml','.yml') {
    $text = [IO.File]::ReadAllText($file.FullName)
    if ($ext -in '.html','.htm','.xml') {
      $text = [Net.WebUtility]::HtmlDecode(([regex]::Replace($text, '<[^>]+>', ' ')))
    }
    return $text
  }
  if ($ext -eq '.docx') {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($file.FullName)
    try {
      $entry = $zip.GetEntry('word/document.xml')
      if (-not $entry) { return '' }
      $reader = [IO.StreamReader]::new($entry.Open(), [Text.Encoding]::UTF8)
      try { $xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
      $xml = $xml -replace '</w:p>', "`n" -replace '<w:tab[^>]*/>', "`t"
      return [Net.WebUtility]::HtmlDecode(([regex]::Replace($xml, '<[^>]+>', ' ')))
    } finally { $zip.Dispose() }
  }
  if ($ext -eq '.pdf') {
    $tool = Get-Command pdftotext.exe -ErrorAction SilentlyContinue
    if (-not $tool) { throw 'PDF text extractor is not installed.' }
    $temp = [IO.Path]::GetTempFileName()
    try { & $tool.Source -enc UTF-8 -nopgbrk $file.FullName $temp 2>$null; return [IO.File]::ReadAllText($temp) } finally { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
  }
  return ''
}

function Split-LibraryText([string]$text) {
  $chunks = New-Object System.Collections.Generic.List[string]
  $clean = [regex]::Replace($text, '\s+', ' ').Trim()
  $start = 0
  while ($start -lt $clean.Length) {
    $length = [Math]::Min(2800, $clean.Length - $start)
    $chunks.Add($clean.Substring($start, $length))
    if ($start + $length -ge $clean.Length) { break }
    $start += 2500
  }
  return @($chunks)
}

function Update-LibraryIndex {
  $documents = New-Object System.Collections.Generic.List[object]
  $skipped = New-Object System.Collections.Generic.List[string]
  Get-ChildItem -LiteralPath $libraryRoot -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $indexPath -and $_.Extension.ToLowerInvariant() -in '.txt','.md','.csv','.json','.xml','.html','.htm','.log','.yaml','.yml','.docx','.pdf' -and $_.Length -lt 100MB } |
    ForEach-Object {
      try {
        $text = Convert-ToLibraryText $_
        if (-not [string]::IsNullOrWhiteSpace($text)) {
          $documents.Add([pscustomobject]@{ title=$_.BaseName; path=$_.FullName; modified=$_.LastWriteTimeUtc.ToString('o'); chunks=@(Split-LibraryText $text) })
        }
      } catch { $skipped.Add("$($_.Name): $($_.Exception.Message)") }
    }
  $script:LibraryIndex = [pscustomobject]@{ version=1; builtAt=[DateTime]::UtcNow.ToString('o'); documents=$documents.ToArray(); skipped=$skipped.ToArray() }
  [IO.File]::WriteAllText($indexPath, ($script:LibraryIndex | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  return Get-LibraryStatus
}

function Get-LibraryStatus {
  $docs = @($script:LibraryIndex.documents)
  return @{ documents=$docs.Count; chunks=@($docs | ForEach-Object { @($_.chunks).Count } | Measure-Object -Sum).Sum; builtAt=$script:LibraryIndex.builtAt; skipped=@($script:LibraryIndex.skipped).Count; folder=$libraryRoot }
}

function Import-LibraryDocument($payload) {
  $title = if ([string]::IsNullOrWhiteSpace([string]$payload.title)) { 'Atlas Library Document' } else { [string]$payload.title }
  $safe = [regex]::Replace($title, '[^\p{L}\p{N}._-]', '-')
  if ($safe.Length -gt 90) { $safe = $safe.Substring(0,90) }
  $hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes("$title|$($payload.sourceUrl)"))
  $hash = ([BitConverter]::ToString($hashBytes)).Replace('-','').Substring(0,12).ToLowerInvariant()
  $target = Join-Path $importRoot "$hash-$safe.txt"
  $content = "TITLE: $title`r`nSOURCE URL: $($payload.sourceUrl)`r`nTYPE: $($payload.kind)`r`n`r`n$($payload.text)"
  [IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
  return @{ ok=$true; path=$target }
}

function Get-LocalLibraryContext([string]$question) {
  $terms = @($question.ToLowerInvariant() -split '[^\p{L}\p{N}]+' | Where-Object { $_.Length -gt 2 } | Select-Object -Unique -First 10)
  if (-not $terms.Count) { return '' }
  $matches = New-Object System.Collections.Generic.List[object]
  foreach ($doc in @($script:LibraryIndex.documents)) {
    $i = 0
    foreach ($chunk in @($doc.chunks)) {
      $score = @($terms | Where-Object { $chunk.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count
      if ($score -gt 0) { $matches.Add([pscustomobject]@{ score=$score; citation="SOURCE: $($doc.title) (chunk $i)`n$chunk" }) }
      $i++
    }
  }
  return (@($matches | Sort-Object score -Descending | Select-Object -First 6 | ForEach-Object { $_.citation }) -join "`n`n---`n`n")
}

function Get-KiwixKnowledge([string]$question) {
  # Snapshot knowledge is useful for durable subjects, never for claims that
  # can change operationally or cause harm when stale.
  $volatileOrHighRisk = '(?i)(?<!\p{L})(bug[uü]n(?:k[uü])?|şimdi|g[uü]ncel|son dakika|canlı|hava durumu|weather|forecast|fiyat(?:ı|lar(?:ı)?)?|kur(?:u|lar(?:ı)?)?|d[oö]viz|borsa|hisse|kripto|seçim|başkan|cumhurbaşkanı|bakan|yasa|mevzuat|hukuk|ilaç|doz|teşhis|tedavi|acil|notices to mariners|chart correction|liman durumu)(?!\p{L})'
  if ($question -match $volatileOrHighRisk) {
    return [pscustomobject]@{ state='BLOCKED_STALE_OR_HIGH_RISK'; context=''; reason='Current or high-risk claims require current authoritative verification.'; results=0 }
  }
  try {
    $base = [Uri]$KiwixUrl
    if ($base.Scheme -ne 'http' -or $base.Host -notin @('127.0.0.1','localhost')) { throw 'KIWIX_LOOPBACK_ONLY' }
    $query = [Uri]::EscapeDataString($question.Trim())
    $uri = "$($base.GetLeftPart([UriPartial]::Authority))/search?books.filter.lang=tur&pattern=$query&pageLength=5&format=xml"
    [xml]$document = Invoke-LocalTextGet $uri 8
    $items = @($document.rss.channel.item | Select-Object -First 5)
    if (-not $items.Count) { return [pscustomobject]@{ state='NO_MATCH'; context=''; reason='No indexed encyclopedia result matched.'; results=0 } }
    $citations = foreach ($item in $items) {
      $title = [Net.WebUtility]::HtmlDecode([string]$item.title)
      $description = [regex]::Replace([Net.WebUtility]::HtmlDecode([string]$item.description), '<[^>]+>', ' ')
      $description = [regex]::Replace($description, '\s+', ' ').Trim()
      if ($description.Length -gt 900) { $description = $description.Substring(0,900) + '…' }
      "SOURCE: Turkish Wikipedia - $title`nOFFLINE URI: $($item.link)`nEXCERPT: $description"
    }
    return [pscustomobject]@{ state='VERIFIED_OFFLINE_MATCH'; context=($citations -join "`n`n---`n`n"); reason=''; results=$items.Count }
  } catch {
    return [pscustomobject]@{ state='UNAVAILABLE'; context=''; reason=$_.Exception.Message; results=0 }
  }
}

function Invoke-QwenFinalAnswerRetry($selection, [string]$question, [string]$privateDraft) {
  if ([string]::IsNullOrWhiteSpace($privateDraft)) { throw 'The local AI returned no answer.' }
  # A long evidence-grounded turn can spend its whole first generation in
  # Qwen's private thinking channel. Keep only the conclusion-bearing tail of
  # that local draft and ask for one bounded final-answer pass. The private
  # draft is never copied into the Bridge response.
  $draftLimit = 6000
  $boundedDraft = if ($privateDraft.Length -gt $draftLimit) { $privateDraft.Substring($privateDraft.Length - $draftLimit) } else { $privateDraft }
  $retryMessages = @(
    @{ role='system'; content='Produce the final answer only. Use the same language as the original question. Do not mention or reveal the private draft. Be accurate, concise, and preserve any source qualifications found in the draft.' },
    @{ role='user'; content="ORIGINAL QUESTION:`n$question`n`nPRIVATE LOCAL DRAFT:`n$boundedDraft`n`nFINAL ANSWER:" }
  )
  $retryRequest = @{ model=$selection.model; messages=$retryMessages; stream=$false; think=$false; keep_alive='30m'; options=@{ temperature=0.2; num_ctx=8192; num_predict=1024 } }
  $retryResult = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/chat' ($retryRequest | ConvertTo-Json -Depth 12 -Compress)
  $finalAnswer = [string]$retryResult.message.content
  if ([string]::IsNullOrWhiteSpace($finalAnswer)) { throw 'The local AI returned no answer after a bounded final-answer retry.' }
  return [pscustomobject]@{ answer=$finalAnswer.Trim(); model=[string]$retryResult.model }
}

function Convert-ToSafeQwenChatText([string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return '' }
  # Raw ChatML is used only to bypass the broken qwen3:4b Ollama template.
  # Neutralize its reserved delimiters so library or user text cannot inject
  # a new role into the local prompt.
  return $text.Replace('<|im_start|>', '[im_start]').Replace('<|im_end|>', '[im_end]')
}

function Invoke-QwenFastFinalAnswer($selection, $messages) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($message in @($messages)) {
    $role = if ([string]$message.role -eq 'assistant') { 'assistant' } elseif ([string]$message.role -eq 'system') { 'system' } else { 'user' }
    $content = if ($role -eq 'system') {
      'You are Captain Sinbad. Reply directly, accurately and concisely in the user language. Keep supplied source qualifications and cite their titles. Never invent current weather, navigation warnings, regulations or vessel data. Never reveal private reasoning. Never take external actions.'
    } else { [string]$message.content }
    $safeContent = Convert-ToSafeQwenChatText $content
    $parts.Add("<|im_start|>$role`n$safeContent<|im_end|>")
  }
  # The installed stock qwen3:4b template opens a thinking block even when
  # think=false.  Raw generation plus a pre-closed private block avoids that
  # template.  Qwen may still generate a bounded private draft; only text
  # after its final closing tag is eligible to cross the Bridge boundary.
  $prompt = ($parts -join "`n") + "`n<|im_start|>assistant`n<think>`n`n</think>`n`n"
  $fastRequest = @{
    model=$selection.model
    prompt=$prompt
    raw=$true
    stream=$false
    keep_alive='30m'
    options=@{ temperature=0.2; num_ctx=8192; num_predict=512; stop=@('<|im_end|>','<|im_start|>') }
  }
  $fastResult = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/generate' ($fastRequest | ConvertTo-Json -Depth 12 -Compress)
  $raw = [string]$fastResult.response
  $closingTag = '</think>'
  $closingIndex = $raw.LastIndexOf($closingTag, [StringComparison]::OrdinalIgnoreCase)
  if ($closingIndex -lt 0) { throw 'FAST_FINAL_NOT_READY' }
  $finalAnswer = $raw.Substring($closingIndex + $closingTag.Length).Trim()
  if ([string]::IsNullOrWhiteSpace($finalAnswer)) { throw 'FAST_FINAL_NOT_READY' }
  if ($finalAnswer -match '(?is)<think>|</think>') { throw 'FAST_FINAL_BOUNDARY_VIOLATION' }
  return [pscustomobject]@{ answer=$finalAnswer; model=[string]$fastResult.model }
}

function Test-SinbadDirectFastQuestion([string]$question) {
  $text = $question.Trim().ToLowerInvariant()
  if ($text.Length -gt 120) { return $false }
  if ($text -match '^(merhaba|selam|günaydın|iyi (akşamlar|geceler)|hello|hi|hallo)[.!? ]*$') { return $true }
  # Social turns bypass the full owner-library scan; factual questions still
  # retain evidence retrieval.
  if ($text -match '(kendini (?:bir cümleyle )?tanıt|sen kimsin|nasılsın|ne yapabilirsin|benimle konuş|sohbet edelim)') { return $true }
  if ($text -match '(introduce yourself|who are you|how are you|what can you do|let.s chat)') { return $true }
  if ($text -match '(stell dich vor|wer bist du|wie geht es dir|was kannst du|lass uns reden)') { return $true }
  # A bounded arithmetic expression with an optional natural-language suffix
  # is stable knowledge and needs neither the 90k-chunk owner index nor Kiwix.
  return $text -match '^\s*[-+]?\d+(?:[.,]\d+)?(?:\s*[-+*x×÷/]\s*[-+]?\d+(?:[.,]\d+)?)+\s*(?:kaç eder|nedir|sonucu(?: nedir)?|equals?|gleich)?\s*[?!.]*\s*$'
}

function Resolve-SinbadDirectStableAnswer([string]$question) {
  $text = $question.Trim()
  $lower = $text.ToLowerInvariant()
  if ($lower -match '^(merhaba|selam|günaydın|iyi (akşamlar|geceler))[.!? ]*$') {
    return 'Merhaba kaptan. Nasıl yardımcı olabilirim?'
  }
  if ($lower -match '^(hello|hi)[.!? ]*$') { return 'Hello, Captain. How can I help?' }
  if ($lower -match '^hallo[.!? ]*$') { return 'Hallo, Kapitän. Wie kann ich helfen?' }
  if ($lower -notmatch '^\s*(?<expression>[-+]?\d+(?:[.,]\d+)?(?:\s*[-+*x×÷/]\s*[-+]?\d+(?:[.,]\d+)?)+)\s*(?:kaç eder|nedir|sonucu(?: nedir)?|equals?|gleich)?\s*[?!.]*\s*$') { return '' }
  $displayExpression = $Matches.expression.Trim()
  $safeExpression = $displayExpression.Replace('×','*').Replace('÷','/').Replace('x','*').Replace(',','.')
  try {
    $table = [System.Data.DataTable]::new()
    $value = $table.Compute($safeExpression,$null)
    $formatted = [Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)
    if ($lower -match 'gleich') { return "$displayExpression ergibt $formatted." }
    if ($lower -match 'equals?') { return "$displayExpression equals $formatted." }
    return "$displayExpression eşittir $formatted."
  } catch { return '' }
}

function Invoke-SinbadLocalAi($payload) {
  $question = [string]$payload.question
  if ([string]::IsNullOrWhiteSpace($question)) { throw 'A question is required.' }
  $stableAnswer = Resolve-SinbadDirectStableAnswer $question
  if (-not [string]::IsNullOrWhiteSpace($stableAnswer)) {
    return @{ answer=$stableAnswer; model='sinbad-deterministic-core'; modelTier='instant'; routing=@{ preferredModel='sinbad-deterministic-core'; selectedModel='sinbad-deterministic-core'; fallbackUsed=$false; fastFinalPathUsed=$false; finalAnswerRetryUsed=$false; complexityScore=0; reasons=@('stable-direct-answer') }; mode='offline-deterministic'; knowledge=@{ state='NOT_REQUIRED'; results=0; reason='stable-direct-answer' } }
  }
  $history = @($payload.history | ForEach-Object {
    @{ role=if ($_.role -eq 'assistant' -or $_.role -eq 'sinbad') {'assistant'} else {'user'}; content=[string]$_.content }
  } | Select-Object -Last 10)
  $directFastQuestion = Test-SinbadDirectFastQuestion $question
  $context = if ($directFastQuestion) { '' } else { Get-LocalLibraryContext $question }
  $kiwix = if ($directFastQuestion) { [pscustomobject]@{ state='NOT_REQUIRED'; context=''; reason='stable-direct-question'; results=0 } } else { Get-KiwixKnowledge $question }
  $system = @'
You are Captain Sinbad, the offline assistant of Atlas Marine OS. Be a warm, intelligent companion and a practical marine guide. Your primary working languages are Turkish, English and German. Detect which of these languages the user is writing in and reply naturally in the same language unless the user requests another language. You can translate accurately among Turkish, English and German, preserving maritime and technical terminology. Use complete, natural answers and conversation history. You can help with seamanship education, passage-plan drafts, checklists, documents, software and programming. Never invent live weather, current Notices to Mariners, chart corrections, port status, coordinates, depths or regulations. Clearly say when internet, current official publications or vessel-specific data are required. You are planning and decision support, not certified ECDIS. For code changes, explain the plan and create a reviewable draft; never publish, delete data, spend money or change credentials without explicit owner approval.
When LOCAL OWNER LIBRARY EXCERPTS are supplied, reason from them, distinguish quoted evidence from your inference, and cite the source title in the answer. Never claim a source says something absent from the excerpts.
When OFFLINE ENCYCLOPEDIA EXCERPTS are supplied, use them as dated reference evidence, cite the article title, and never describe them as current. If OFFLINE KNOWLEDGE POLICY says BLOCKED_STALE_OR_HIGH_RISK, do not answer the volatile claim from memory: state what current authoritative source is required.
'@
  $messages = @(@{ role='system'; content=$system }) + $history
  $evidence = New-Object System.Collections.Generic.List[string]
  if ($context) { $evidence.Add("LOCAL OWNER LIBRARY EXCERPTS:`n$context") }
  if ($kiwix.context) { $evidence.Add("OFFLINE ENCYCLOPEDIA EXCERPTS (Wikipedia Turkish snapshot 2026-04-12):`n$($kiwix.context)") }
  if ($kiwix.state -eq 'BLOCKED_STALE_OR_HIGH_RISK') { $evidence.Add("OFFLINE KNOWLEDGE POLICY: BLOCKED_STALE_OR_HIGH_RISK`n$($kiwix.reason)") }
  $userContent = if ($evidence.Count) { "$question`n`n$($evidence -join "`n`n")" } else { $question }
  $messages += @{ role='user'; content=$userContent }
  $ollama = Get-OllamaStatus
  $evidenceLength = ($evidence -join "`n`n").Length
  $selection = Select-SinbadModelTier -Question $question -HistoryCount $history.Count -EvidenceLength $evidenceLength -RequestedDepth ([string]$payload.depth) -FastModel $FastAiModel -DeepModel $AiModel -AvailableModels @($ollama.models)
  $contextWindow = if ($selection.tier -eq 'deep') { 32768 } else { 8192 }
  # Qwen3's installed Ollama template always opens a <think> block. Asking the
  # API to suppress thinking can therefore discard the whole generation and
  # expose an empty content field. Keep thinking server-side, then return only
  # message.content below; internal reasoning never crosses the Bridge API.
  $answer = ''
  $answerModel = ''
  $finalAnswerRetryUsed = $false
  $fastFinalPathUsed = $false
  if ($selection.tier -eq 'fast' -and $selection.model -eq 'qwen3:4b') {
    try {
      $fastFinal = Invoke-QwenFastFinalAnswer $selection $messages
      $answer = $fastFinal.answer
      $answerModel = $fastFinal.model
      $fastFinalPathUsed = $true
    } catch {
      # Preserve correctness if the bounded fast pass does not reach a final
      # answer.  The existing separated-thinking path remains the fail-safe.
    }
  }
  if ([string]::IsNullOrWhiteSpace($answer)) {
    $predictBudget = if ($selection.tier -eq 'fast') { 192 } else { 2048 }
    $request = @{ model=$selection.model; messages=$messages; stream=$false; think=$false; keep_alive='30m'; options=@{ temperature=0.35; num_ctx=$contextWindow; num_predict=$predictBudget } }
    $result = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/chat' ($request | ConvertTo-Json -Depth 12 -Compress)
    $answer = [string]$result.message.content
    $answerModel = [string]$result.model
    if ([string]::IsNullOrWhiteSpace($answer)) {
      $recovery = Invoke-QwenFinalAnswerRetry $selection $question ([string]$result.message.thinking)
      $answer = $recovery.answer
      $answerModel = $recovery.model
      $finalAnswerRetryUsed = $true
    }
  }
  $mode = if ($context -and $kiwix.context) {'offline-owner-and-world-rag'} elseif ($context) {'offline-local-rag'} elseif ($kiwix.context) {'offline-world-rag'} elseif ($kiwix.state -eq 'BLOCKED_STALE_OR_HIGH_RISK') {'offline-current-claim-blocked'} else {'offline-local-ai'}
  return @{ answer=$answer; model=$answerModel; modelTier=$selection.tier; routing=@{ preferredModel=$selection.preferredModel; selectedModel=$selection.model; fallbackUsed=$selection.fallbackUsed; fastFinalPathUsed=$fastFinalPathUsed; finalAnswerRetryUsed=$finalAnswerRetryUsed; complexityScore=$selection.complexityScore; reasons=$selection.reasons }; mode=$mode; knowledge=@{ state=$kiwix.state; results=$kiwix.results; reason=$kiwix.reason } }
}

if (Test-Path -LiteralPath $indexPath) {
  try { $script:LibraryIndex = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json } catch { $script:LibraryIndex = $null }
}
if (-not $script:LibraryIndex) { $null = Update-LibraryIndex }
$workerStartup = Start-XttsWorkerIfNeeded
Write-Host "XTTS worker state: $($workerStartup.state)"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 10000
      $headerBuffer = [IO.MemoryStream]::new()
      $tail = New-Object System.Collections.Generic.Queue[byte]
      while ($headerBuffer.Length -lt 65536) {
        $nextByte = $stream.ReadByte()
        if ($nextByte -lt 0) { break }
        $headerBuffer.WriteByte([byte]$nextByte)
        $tail.Enqueue([byte]$nextByte)
        if ($tail.Count -gt 4) { $null = $tail.Dequeue() }
        if ($tail.Count -eq 4 -and (@($tail) -join ',') -eq '13,10,13,10') { break }
      }
      $headerText = [Text.Encoding]::ASCII.GetString($headerBuffer.ToArray())
      $headerLines = @($headerText -split "`r`n")
      $requestLine = $headerLines[0]
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
      $requestParts = $requestLine.Split(' ')
      $method = $requestParts[0].ToUpperInvariant()
      $path = $requestParts[1].Split('?')[0]
      $headers = @{}
      $headerLines | Select-Object -Skip 1 | ForEach-Object {
        $line = $_
        if (-not [string]::IsNullOrEmpty($line)) {
        $separator = $line.IndexOf(':')
        if ($separator -gt 0) { $headers[$line.Substring(0,$separator).Trim().ToLowerInvariant()] = $line.Substring($separator+1).Trim() }
        }
      }
      $requestOrigin = if ($headers.ContainsKey('origin')) { [string]$headers['origin'] } else { '' }
      if (-not (Test-AllowedBrowserOrigin $requestOrigin)) {
        $script:ResponseOrigin = 'https://sinbad-marine.github.io'
        Write-HttpResponse $stream 403 'Forbidden' (Json @{ error='AI_CHAT_ORIGIN_DENIED' }); continue
      }
      $script:ResponseOrigin = if ([string]::IsNullOrWhiteSpace($requestOrigin)) { 'https://sinbad-marine.github.io' } else { $requestOrigin }
      $body = ''
      $contentLength = if ($headers.ContainsKey('content-length')) { [int]$headers['content-length'] } else { 0 }
      if ($contentLength -gt 0) {
        $buffer = [byte[]]::new($contentLength)
        $read = 0
        while ($read -lt $contentLength) { $count = $stream.Read($buffer, $read, $contentLength-$read); if ($count -le 0) { break }; $read += $count }
        $body = [Text.Encoding]::UTF8.GetString($buffer, 0, $read)
      }

      if ($method -eq 'OPTIONS') { Write-HttpResponse $stream 204 'No Content' ''; continue }
      if ($method -eq 'GET' -and $path -eq '/status') {
        $count = @(Get-ChildItem -LiteralPath $routeRoot -Filter '*.gpx' -File -ErrorAction SilentlyContinue).Count
        $kiwixState = try { $xml=Invoke-LocalTextGet "$KiwixUrl/search?books.filter.lang=tur&pattern=Sinbad&pageLength=1&format=xml" 2; if($xml -match '<rss'){'READY'}else{'INVALID_RESPONSE'} } catch {'UNAVAILABLE'}
        Write-HttpResponse $stream 200 'OK' (Json @{ name='Sinbad Bridge'; version='0.5.0'; routes=$count; exchangeFolder=$routeRoot; libraryFolder=$libraryRoot; library=(Get-LibraryStatus); ai=(Get-OllamaStatus); worldKnowledge=@{ provider='kiwix'; endpoint=$KiwixUrl; state=$kiwixState; snapshot='wikipedia_tr_top_mini_2026-04' } }); continue
      }
      if ($method -eq 'GET' -and $path -eq '/library/status') { Write-HttpResponse $stream 200 'OK' (Json (Get-LibraryStatus)); continue }
      if ($method -eq 'GET' -and $path -eq '/studio/status') { Write-HttpResponse $stream 200 'OK' (Json (Get-StudioCapabilityStatus)); continue }
      if ($method -eq 'GET' -and $path -eq '/opencpn/status') { Write-HttpResponse $stream 200 'OK' (Json (Get-OpenCpnWindowStatus)); continue }
      if ($method -eq 'GET' -and $path -eq '/opencpn/frame') { Write-HttpBytes $stream 200 'OK' (Get-OpenCpnWindowFrame) 'image/png'; continue }
      if ($method -eq 'POST' -and $path -eq '/opencpn/start') { if ($contentLength -gt 256) { throw 'OPENCPN_START_REQUEST_TOO_LARGE' }; Write-HttpResponse $stream 200 'OK' (Json (Start-OpenCpnWindow)); continue }
      if ($method -eq 'POST' -and $path -eq '/opencpn/input') { if ($contentLength -gt 4096) { throw 'OPENCPN_INPUT_REQUEST_TOO_LARGE' }; Write-HttpResponse $stream 200 'OK' (Json (Send-OpenCpnWindowInput ($body | ConvertFrom-Json))); continue }
      if ($method -eq 'POST' -and $path -eq '/library/reindex') { Write-HttpResponse $stream 200 'OK' (Json (Update-LibraryIndex)); continue }
      if ($method -eq 'POST' -and $path -eq '/library/ingest') {
        $payload = $body | ConvertFrom-Json
        $result = Import-LibraryDocument $payload
        Write-HttpResponse $stream 201 'Created' (Json $result); continue
      }
      if ($method -eq 'GET' -and $path -eq '/ai/status') {
        Write-HttpResponse $stream 200 'OK' (Json (Get-OllamaStatus)); continue
      }
      if ($method -eq 'GET' -and $path -eq '/ai/tts/status') {
        Write-HttpResponse $stream 200 'OK' (Json (Get-XttsStatus)); continue
      }
      if ($method -eq 'POST' -and $path -eq '/ai/tts') {
        if ($contentLength -gt 8192) { throw 'XTTS_REQUEST_TOO_LARGE' }
        $origin = if ($headers.ContainsKey('origin')) { [string]$headers['origin'] } else { '' }
        if ($origin -and $origin -ne 'https://sinbad-marine.github.io') { throw 'XTTS_ORIGIN_DENIED' }
        $payload = $body | ConvertFrom-Json
        $audio = Invoke-XttsVoice $payload
        Write-HttpBytes $stream 200 'OK' $audio 'audio/wav'; continue
      }
      if ($method -eq 'POST' -and $path -eq '/ai/chat') {
        $payload = $body | ConvertFrom-Json
        Write-HttpResponse $stream 200 'OK' (Json (Invoke-SinbadLocalAi $payload)); continue
      }
      if ($method -eq 'POST' -and $path -eq '/visuals/search') {
        $payload = $body | ConvertFrom-Json
        Write-HttpResponse $stream 200 'OK' (Json (Search-VisualAtlas $payload)); continue
      }
      if ($method -eq 'GET' -and $path -eq '/visuals/status') {
        Write-HttpResponse $stream 200 'OK' (Json (Invoke-VisualAtlasHelper @('--status'))); continue
      }
      if ($method -eq 'GET' -and $path -match '^/visuals/assets/([0-9a-f]{64})\.webp$') {
        $asset = Invoke-VisualAtlasHelper @('--asset-hash', $Matches[1])
        $bytes = [IO.File]::ReadAllBytes([string]$asset.absolutePath)
        Write-HttpBytes $stream 200 'OK' $bytes 'image/webp'; continue
      }
      if ($method -eq 'GET' -and $path -eq '/routes') {
        $routes = Get-ChildItem -LiteralPath $routeRoot -Filter '*.gpx' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object { @{ name=$_.Name; size=$_.Length; modified=$_.LastWriteTime.ToString('o') } }
        Write-HttpResponse $stream 200 'OK' (Json @{ routes=@($routes) }); continue
      }
      if ($method -eq 'POST' -and $path -eq '/routes') {
        $payload = $body | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($payload.gpx) -or $payload.gpx -notmatch '<gpx') { throw 'A valid GPX document is required.' }
        $filename = [IO.Path]::GetFileName([string]$payload.filename)
        $filename = [regex]::Replace($filename, '[^a-zA-Z0-9._-]', '-')
        if (-not $filename.EndsWith('.gpx', [StringComparison]::OrdinalIgnoreCase)) { $filename += '.gpx' }
        if ([string]::IsNullOrWhiteSpace($filename)) { $filename = 'sinbad-route.gpx' }
        $target = Join-Path $routeRoot $filename
        [IO.File]::WriteAllText($target, [string]$payload.gpx, [Text.UTF8Encoding]::new($false))
        Write-HttpResponse $stream 201 'Created' (Json @{ ok=$true; filename=$filename; path=$target }); continue
      }
      if ($method -eq 'POST' -and $path -eq '/routes/open') {
        if ($contentLength -gt 2097152) { throw 'GPX_REQUEST_TOO_LARGE' }
        $origin = if ($headers.ContainsKey('origin')) { [string]$headers['origin'] } else { '' }
        if ($origin -and $origin -ne 'https://sinbad-marine.github.io') { throw 'OPENCPN_ORIGIN_DENIED' }
        $payload = $body | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($payload.gpx) -or $payload.gpx -notmatch '<gpx' -or $payload.gpx -notmatch '<rte') { throw 'A GPX route is required.' }
        $filename = [IO.Path]::GetFileName([string]$payload.filename)
        $filename = [regex]::Replace($filename, '[^a-zA-Z0-9._-]', '-')
        if (-not $filename.EndsWith('.gpx', [StringComparison]::OrdinalIgnoreCase)) { $filename += '.gpx' }
        if ([string]::IsNullOrWhiteSpace($filename)) { $filename = 'sinbad-route.gpx' }
        $target = Join-Path $routeRoot $filename
        [IO.File]::WriteAllText($target, [string]$payload.gpx, [Text.UTF8Encoding]::new($false))
        if ([string]::IsNullOrWhiteSpace($OpenCpnExecutable) -or -not (Test-Path -LiteralPath $OpenCpnExecutable)) { throw 'OPENCPN_NOT_INSTALLED' }
        $openCpnProcess = Get-Process -Name 'opencpn' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $openCpnProcess) {
          # OpenCPN for Windows does not support importing a positional GPX
          # argument. Launch it normally; passing $target here can crash it.
          $openCpnProcess = Start-Process -FilePath $OpenCpnExecutable -PassThru
          Start-Sleep -Seconds 5
        }
        $transfer = Send-RouteToOpenCpn ([string]$payload.gpx)
        Write-HttpResponse $stream 201 'Created' (Json @{
          ok=$true
          opened=$true
          imported=[bool]$transfer.imported
          importRequired=(-not [bool]$transfer.imported)
          transferReason=$transfer.reason
          filename=$filename
          path=$target
          application='OpenCPN'
          message=$(if ($transfer.imported) { 'The route was transferred to OpenCPN and activated.' } else { 'OpenCPN started safely. Import the saved GPX using Route & Mark Manager.' })
        }); continue
      }
      Write-HttpResponse $stream 404 'Not Found' (Json @{ error='Not found' })
    } catch {
      try {
        if ($stream -and $stream.CanWrite) { Write-HttpResponse $stream 400 'Bad Request' (Json @{ error=$_.Exception.Message }) }
      } catch {
        # A disconnected client is harmless; continue serving new requests.
      }
    } finally {
      if ($headerBuffer) { $headerBuffer.Dispose() }
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
}

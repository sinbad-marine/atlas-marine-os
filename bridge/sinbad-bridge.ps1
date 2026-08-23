param(
  [int]$Port = 31983,
  [string]$ExchangeRoot = '',
  [string]$AiModel = 'qwen3:14b',
  [string]$FastAiModel = 'qwen3:4b',
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
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = 'curl.exe'
  $info.Arguments = "--noproxy * --silent --show-error --max-time 600 -H `"Content-Type: application/json`" --data-binary @- $uri"
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = [Text.Encoding]::UTF8
  $process = [Diagnostics.Process]::Start($info)
  $process.StandardInput.Write($json)
  $process.StandardInput.Close()
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Local AI request failed: $errorText" }
  return ($output | ConvertFrom-Json)
}

function Write-HttpResponse($stream, [int]$status, [string]$statusText, [string]$body, [string]$contentType = 'application/json; charset=utf-8') {
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($body)
  $headers = @(
    "HTTP/1.1 $status $statusText"
    "Content-Type: $contentType"
    "Content-Length: $($bodyBytes.Length)"
    'Access-Control-Allow-Origin: https://sinbad-marine.github.io'
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
    'Access-Control-Allow-Origin: https://sinbad-marine.github.io'
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
      "SOURCE: Turkish Wikipedia — $title`nOFFLINE URI: $($item.link)`nEXCERPT: $description"
    }
    return [pscustomobject]@{ state='VERIFIED_OFFLINE_MATCH'; context=($citations -join "`n`n---`n`n"); reason=''; results=$items.Count }
  } catch {
    return [pscustomobject]@{ state='UNAVAILABLE'; context=''; reason=$_.Exception.Message; results=0 }
  }
}

function Invoke-SinbadLocalAi($payload) {
  $question = [string]$payload.question
  if ([string]::IsNullOrWhiteSpace($question)) { throw 'A question is required.' }
  $history = @($payload.history | ForEach-Object {
    @{ role=if ($_.role -eq 'assistant' -or $_.role -eq 'sinbad') {'assistant'} else {'user'}; content=[string]$_.content }
  } | Select-Object -Last 10)
  $context = Get-LocalLibraryContext $question
  $kiwix = Get-KiwixKnowledge $question
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
  $request = @{ model=$selection.model; messages=$messages; stream=$false; think=$true; keep_alive='30m'; options=@{ temperature=0.35; num_ctx=$contextWindow } }
  $result = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/chat' ($request | ConvertTo-Json -Depth 12 -Compress)
  if ([string]::IsNullOrWhiteSpace($result.message.content)) { throw 'The local AI returned no answer.' }
  $mode = if ($context -and $kiwix.context) {'offline-owner-and-world-rag'} elseif ($context) {'offline-local-rag'} elseif ($kiwix.context) {'offline-world-rag'} elseif ($kiwix.state -eq 'BLOCKED_STALE_OR_HIGH_RISK') {'offline-current-claim-blocked'} else {'offline-local-ai'}
  return @{ answer=$result.message.content; model=$result.model; modelTier=$selection.tier; routing=@{ preferredModel=$selection.preferredModel; selectedModel=$selection.model; fallbackUsed=$selection.fallbackUsed; complexityScore=$selection.complexityScore; reasons=$selection.reasons }; mode=$mode; knowledge=@{ state=$kiwix.state; results=$kiwix.results; reason=$kiwix.reason } }
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

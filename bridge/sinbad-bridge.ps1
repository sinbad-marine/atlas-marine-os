param(
  [int]$Port = 31983,
  [string]$ExchangeRoot = '',
  [string]$AiModel = 'qwen3:14b',
  [string]$XttsExecutable = '',
  [string]$XttsModelPath = '',
  [string]$XttsConfigPath = '',
  [string]$XttsSpeakerWav = '',
  [string]$OpenCpnExecutable = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$bridgeRoot = if ([string]::IsNullOrWhiteSpace($ExchangeRoot)) { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sinbad Bridge' } else { $ExchangeRoot }
$routeRoot = Join-Path $bridgeRoot 'Routes'
$libraryRoot = Join-Path $bridgeRoot 'Library'
$importRoot = Join-Path $libraryRoot 'Imported'
$indexPath = Join-Path $libraryRoot '.sinbad-index.json'
$userProfileRoot = [Environment]::GetFolderPath('UserProfile')
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
$voiceTempRoot = Join-Path $bridgeRoot 'Voice\Temp'
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
Write-Host "Offline AI model: $AiModel"
Write-Host "XTTS voice clone: $((Test-Path -LiteralPath $XttsExecutable) -and (Test-Path -LiteralPath $XttsModelPath) -and (Test-Path -LiteralPath $XttsConfigPath) -and (Test-Path -LiteralPath $XttsSpeakerWav))"
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

function Json($value) { return ($value | ConvertTo-Json -Depth 8 -Compress) }

function Get-OllamaStatus {
  try {
    $tags = Invoke-LocalJsonGet 'http://127.0.0.1:11434/api/tags'
    $models = @($tags.models | ForEach-Object { $_.name })
    return @{ online=$true; model=$AiModel; installed=($models -contains $AiModel); models=$models }
  } catch {
    return @{ online=$false; model=$AiModel; installed=$false; models=@() }
  }
}

function Get-XttsStatus {
  $ready = (Test-Path -LiteralPath $XttsExecutable -PathType Leaf) -and
    (Test-Path -LiteralPath $XttsModelPath -PathType Container) -and
    (Test-Path -LiteralPath $XttsConfigPath -PathType Leaf) -and
    (Test-Path -LiteralPath $XttsSpeakerWav -PathType Leaf)
  return @{ online=$ready; engine='coqui-xtts-v2'; profile='owner-local'; language='tr'; busy=[bool]$script:XttsBusy; latencyClass='batch' }
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
  $outputPath = Join-Path $voiceTempRoot "$([guid]::NewGuid().ToString('N')).wav"
  $diagnosticPath = "$outputPath.log"
  $script:XttsBusy = $true
  try {
    $arguments = @(
      '--text', $text,
      '--model_path', $XttsModelPath,
      '--config_path', $XttsConfigPath,
      '--language_idx', $language,
      '--speaker_wav', $XttsSpeakerWav,
      '--out_path', $outputPath
    )
    $previousErrorAction = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & $XttsExecutable @arguments 2> $diagnosticPath | Out-Null
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorAction
    }
    $diagnostic = if (Test-Path -LiteralPath $diagnosticPath) { Get-Content -LiteralPath $diagnosticPath -Raw } else { '' }
    if ($exitCode -ne 0 -or -not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
      throw "XTTS_FAILED: $($diagnostic.Substring(0, [Math]::Min(500, $diagnostic.Length)))"
    }
    $audio = [IO.File]::ReadAllBytes($outputPath)
    if ($audio.Length -lt 44 -or [Text.Encoding]::ASCII.GetString($audio, 0, 4) -ne 'RIFF' -or
        [Text.Encoding]::ASCII.GetString($audio, 8, 4) -ne 'WAVE') { throw 'XTTS_INVALID_WAV' }
    return $audio
  } finally {
    $script:XttsBusy = $false
    Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $diagnosticPath -Force -ErrorAction SilentlyContinue
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

function Invoke-SinbadLocalAi($payload) {
  $question = [string]$payload.question
  if ([string]::IsNullOrWhiteSpace($question)) { throw 'A question is required.' }
  $history = @($payload.history | ForEach-Object {
    @{ role=if ($_.role -eq 'assistant' -or $_.role -eq 'sinbad') {'assistant'} else {'user'}; content=[string]$_.content }
  } | Select-Object -Last 10)
  $context = Get-LocalLibraryContext $question
  $system = @'
You are Captain Sinbad, the offline assistant of Atlas Marine OS. Be a warm, intelligent companion and a practical marine guide. Your primary working languages are Turkish, English and German. Detect which of these languages the user is writing in and reply naturally in the same language unless the user requests another language. You can translate accurately among Turkish, English and German, preserving maritime and technical terminology. Use complete, natural answers and conversation history. You can help with seamanship education, passage-plan drafts, checklists, documents, software and programming. Never invent live weather, current Notices to Mariners, chart corrections, port status, coordinates, depths or regulations. Clearly say when internet, current official publications or vessel-specific data are required. You are planning and decision support, not certified ECDIS. For code changes, explain the plan and create a reviewable draft; never publish, delete data, spend money or change credentials without explicit owner approval.
When LOCAL OWNER LIBRARY EXCERPTS are supplied, reason from them, distinguish quoted evidence from your inference, and cite the source title in the answer. Never claim a source says something absent from the excerpts.
'@
  $messages = @(@{ role='system'; content=$system }) + $history
  $userContent = if ($context) { "$question`n`nLOCAL OWNER LIBRARY EXCERPTS:`n$context" } else { $question }
  $messages += @{ role='user'; content=$userContent }
  $request = @{ model=$AiModel; messages=$messages; stream=$false; think=$false; keep_alive='30m'; options=@{ temperature=0.35; num_ctx=32768 } }
  $result = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/chat' ($request | ConvertTo-Json -Depth 12 -Compress)
  if ([string]::IsNullOrWhiteSpace($result.message.content)) { throw 'The local AI returned no answer.' }
  return @{ answer=$result.message.content; model=$result.model; mode=if ($context) {'offline-local-rag'} else {'offline-local-ai'} }
}

if (Test-Path -LiteralPath $indexPath) {
  try { $script:LibraryIndex = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json } catch { $script:LibraryIndex = $null }
}
if (-not $script:LibraryIndex) { $null = Update-LibraryIndex }

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
        Write-HttpResponse $stream 200 'OK' (Json @{ name='Sinbad Bridge'; version='0.3.0'; routes=$count; exchangeFolder=$routeRoot; libraryFolder=$libraryRoot; library=(Get-LibraryStatus); ai=(Get-OllamaStatus) }); continue
      }
      if ($method -eq 'GET' -and $path -eq '/library/status') { Write-HttpResponse $stream 200 'OK' (Json (Get-LibraryStatus)); continue }
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
        }
        Write-HttpResponse $stream 201 'Created' (Json @{
          ok=$true
          opened=$true
          imported=$false
          importRequired=$true
          filename=$filename
          path=$target
          application='OpenCPN'
          message='OpenCPN started safely. Import the saved GPX using Route & Mark Manager.'
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

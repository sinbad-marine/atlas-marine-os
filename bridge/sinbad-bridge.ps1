param(
  [int]$Port = 31983,
  [string]$ExchangeRoot = '',
  [string]$AiModel = 'qwen3:14b'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$bridgeRoot = if ([string]::IsNullOrWhiteSpace($ExchangeRoot)) { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sinbad Bridge' } else { $ExchangeRoot }
$routeRoot = Join-Path $bridgeRoot 'Routes'
$libraryRoot = Join-Path $bridgeRoot 'Library'
New-Item -ItemType Directory -Force -Path $routeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $libraryRoot | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Sinbad Bridge is online: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "GPX exchange folder: $routeRoot"
Write-Host "Offline library folder: $libraryRoot"
Write-Host "Offline AI model: $AiModel"
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

function Get-LocalLibraryContext([string]$question) {
  $terms = @($question.ToLowerInvariant() -split '[^\p{L}\p{N}]+' | Where-Object { $_.Length -gt 2 } | Select-Object -Unique -First 10)
  if (-not $terms.Count) { return '' }
  $matches = New-Object System.Collections.Generic.List[string]
  Get-ChildItem -LiteralPath $libraryRoot -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in '.txt','.md','.csv','.json' -and $_.Length -lt 10MB } |
    Select-Object -First 250 | ForEach-Object {
      try {
        $text = [IO.File]::ReadAllText($_.FullName)
        $score = @($terms | Where-Object { $text.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count
        if ($score -gt 0) {
          $snippet = $text.Substring(0, [Math]::Min($text.Length, 5000))
          $matches.Add("SOURCE: $($_.Name)`n$snippet")
        }
      } catch {}
    }
  return (@($matches | Select-Object -First 5) -join "`n`n---`n`n")
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
'@
  $messages = @(@{ role='system'; content=$system }) + $history
  $userContent = if ($context) { "$question`n`nLOCAL OWNER LIBRARY EXCERPTS:`n$context" } else { $question }
  $messages += @{ role='user'; content=$userContent }
  $request = @{ model=$AiModel; messages=$messages; stream=$false; think=$false; keep_alive='30m'; options=@{ temperature=0.35; num_ctx=32768 } }
  $result = Invoke-LocalJsonPost 'http://127.0.0.1:11434/api/chat' ($request | ConvertTo-Json -Depth 12 -Compress)
  if ([string]::IsNullOrWhiteSpace($result.message.content)) { throw 'The local AI returned no answer.' }
  return @{ answer=$result.message.content; model=$result.model; mode=if ($context) {'offline-local-rag'} else {'offline-local-ai'} }
}

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
        Write-HttpResponse $stream 200 'OK' (Json @{ name='Sinbad Bridge'; version='0.2.0'; routes=$count; exchangeFolder=$routeRoot; libraryFolder=$libraryRoot; ai=(Get-OllamaStatus) }); continue
      }
      if ($method -eq 'GET' -and $path -eq '/ai/status') {
        Write-HttpResponse $stream 200 'OK' (Json (Get-OllamaStatus)); continue
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

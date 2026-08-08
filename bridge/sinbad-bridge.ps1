param(
  [int]$Port = 31983,
  [string]$ExchangeRoot = ''
)

$ErrorActionPreference = 'Stop'
$bridgeRoot = if ([string]::IsNullOrWhiteSpace($ExchangeRoot)) { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sinbad Bridge' } else { $ExchangeRoot }
$routeRoot = Join-Path $bridgeRoot 'Routes'
New-Item -ItemType Directory -Force -Path $routeRoot | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Sinbad Bridge is online: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "GPX exchange folder: $routeRoot"
Write-Host 'Keep this window open while using the Bridge. Press Ctrl+C to stop.'

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
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bodyBytes.Length) { $stream.Write($bodyBytes, 0, $bodyBytes.Length) }
  $stream.Flush()
}

function Json($value) { return ($value | ConvertTo-Json -Depth 8 -Compress) }

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
      $requestParts = $requestLine.Split(' ')
      $method = $requestParts[0].ToUpperInvariant()
      $path = $requestParts[1].Split('?')[0]
      $headers = @{}
      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
        $separator = $line.IndexOf(':')
        if ($separator -gt 0) { $headers[$line.Substring(0,$separator).Trim().ToLowerInvariant()] = $line.Substring($separator+1).Trim() }
      }
      $body = ''
      $contentLength = if ($headers.ContainsKey('content-length')) { [int]$headers['content-length'] } else { 0 }
      if ($contentLength -gt 0) {
        $buffer = [char[]]::new($contentLength)
        $read = 0
        while ($read -lt $contentLength) { $count = $reader.Read($buffer, $read, $contentLength-$read); if ($count -le 0) { break }; $read += $count }
        $body = [string]::new($buffer, 0, $read)
      }

      if ($method -eq 'OPTIONS') { Write-HttpResponse $stream 204 'No Content' ''; continue }
      if ($method -eq 'GET' -and $path -eq '/status') {
        $count = @(Get-ChildItem -LiteralPath $routeRoot -Filter '*.gpx' -File -ErrorAction SilentlyContinue).Count
        Write-HttpResponse $stream 200 'OK' (Json @{ name='Sinbad Bridge'; version='0.1.0'; routes=$count; exchangeFolder=$routeRoot }); continue
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
      if ($stream -and $stream.CanWrite) { Write-HttpResponse $stream 400 'Bad Request' (Json @{ error=$_.Exception.Message }) }
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
}

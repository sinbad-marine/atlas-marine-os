param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference='Stop'
# Never dot-source Bridge: its top-level code initializes live services and data.
$sourceText=[IO.File]::ReadAllText($Source)
. (Join-Path (Split-Path -Parent $Source) 'argos-owner-boundary.ps1')
# Isolated test never reads installed credentials or connects to an authority.
function Get-ArgosOwnerConfiguration { return $null }
$tokens=$null; $parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($sourceText,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count) { throw 'BRIDGE_PARSE_FAILED' }
foreach ($name in @('Test-AllowedBrowserOrigin','Write-HttpResponse')) {
  $nodes=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$false))
  if ($nodes.Count -ne 1) { throw 'FUNCTION_EXTRACTION_FAILED' }
  . ([scriptblock]::Create($nodes[0].Extent.Text))
}
$gateStart=$sourceText.IndexOf('$script:ArgosBridgeCommandVersion =')
$gateEnd=$sourceText.IndexOf('function Invoke-LocalTextGet', $gateStart)
$requestStart=$sourceText.IndexOf('$stream = $client.GetStream()')
$requestEnd=$sourceText.IndexOf("if (`$method -eq 'GET' -and `$path -eq '/status')",$requestStart)
if ($gateStart -lt 0 -or $gateEnd -le $gateStart -or $requestStart -lt 0 -or $requestEnd -le $requestStart) { throw 'BOUNDARY_EXTRACTION_FAILED' }
. ([scriptblock]::Create($sourceText.Substring($gateStart,$gateEnd-$gateStart)))
function Json($value) { ConvertTo-Json -InputObject $value -Compress -Depth 10 }
# Only the model status dependency is stubbed. No model/device/file executor is loaded.
function Get-OllamaStatus { return @{online=$false;model='ISOLATED_TEST';models=@()} }
$script:ResponseOrigin='https://sinbad-marine.github.io'
$script:AcceptedSentinels=0
$requestBody=$sourceText.Substring($requestStart,$requestEnd-$requestStart)
$loop=@'
try {
  while ($true) {
    $client=$listener.AcceptTcpClient()
    try {
__REQUEST_BODY__
      if ($method -eq 'POST') {
        $script:AcceptedSentinels++
        Write-HttpResponse $stream 200 'OK' (Json @{sentinel=$script:AcceptedSentinels})
      } else {
        Write-HttpResponse $stream 404 'Not Found' '{}'
      }
    } finally { $client.Dispose() }
  }
} finally { $listener.Stop() }
'@
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start()
Write-Output ('ARGOS_TEST_PORT='+$listener.LocalEndpoint.Port)
. ([scriptblock]::Create($loop.Replace('__REQUEST_BODY__',$requestBody)))

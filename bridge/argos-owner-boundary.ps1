# No top-level services or writes. Configuration is installed separately.
function Get-ArgosSha256([byte[]]$bytes) {
  $algorithm=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
  finally { $algorithm.Dispose() }
}
function Get-ArgosOwnerConfiguration {
  $file=Join-Path $env:LOCALAPPDATA 'Sinbad\argos\bridge-owner.json'
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
  try {
    $config=[IO.File]::ReadAllText($file) | ConvertFrom-Json
    if ($config.schemaVersion -ne 'sinbad-argos-bridge-owner/1' -or $config.instanceId -notmatch '^[0-9a-f-]{36}$' -or $config.workspaceId -notmatch '^[0-9a-f-]{36}$' -or $config.projectUrl -cne 'https://kcvyftrvteqmabvxfebu.supabase.co') { return $null }
    return $config
  } catch { return $null }
}
function Invoke-ArgosOwnerService($config,[string]$auth,[string]$json) {
  $secure=ConvertTo-SecureString -String $config.protectedCredential
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false
  $http=[Net.Http.HttpClient]::new($handler)
  try {
    $credential=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($credential -cnotmatch '^[0-9a-f]{64}$') { throw 'BRIDGE_CREDENTIAL_INVALID' }
    $http.Timeout=[TimeSpan]::FromSeconds(10)
    $http.DefaultRequestHeaders.Add('Authorization',$auth)
    $http.DefaultRequestHeaders.Add('apikey',[string]$config.publishableKey)
    $http.DefaultRequestHeaders.Add('X-Sinbad-Bridge-Credential',$credential)
    $content=[Net.Http.StringContent]::new($json,[Text.Encoding]::UTF8,'application/json')
    try {
      $response=$http.PostAsync('https://kcvyftrvteqmabvxfebu.supabase.co/functions/v1/argos-bridge-authorize',$content).GetAwaiter().GetResult()
      try {
        if (-not $response.IsSuccessStatusCode) { throw 'BRIDGE_APPROVAL_REJECTED' }
        $text=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ($text.Length -gt 4096) { throw 'BRIDGE_APPROVAL_RESPONSE_INVALID' }
        return ($text | ConvertFrom-Json)
      } finally { $response.Dispose() }
    } finally { $content.Dispose() }
  } finally {
    $credential=$null;[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose();$http.Dispose();$handler.Dispose()
  }
}
function Test-ArgosOwnerBoundary($headers,[string]$path,[byte[]]$bytes) {
  if ($path -notin @('/library/ingest','/library/reindex','/routes','/routes/open','/opencpn/start','/opencpn/input')) { return @{admitted=$true} }
  try {
    $config=Get-ArgosOwnerConfiguration
    if ($null -eq $config) { return @{admitted=$false;reason='BRIDGE_OWNER_NOT_CONFIGURED'} }
    $auth=[string]$headers['authorization'];$id=[string]$headers['x-sinbad-owner-authorization'];$nonce=[string]$headers['x-sinbad-owner-nonce']
    if ($auth -cnotmatch '^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' -or $id -notmatch '^[0-9a-f-]{36}$' -or $nonce -cnotmatch '^[0-9a-f]{64}$') { return @{admitted=$false;reason='BRIDGE_OWNER_PROOF_REQUIRED'} }
    $command=[ordered]@{action=[string]$headers['x-sinbad-argos-action'];bodyBytes=$bytes.Length;bodySha256=(Get-ArgosSha256 $bytes);commandId=[string]$headers['x-sinbad-argos-command-id'];instanceId=[string]$config.instanceId;method='POST';path=$path;requestedAt=[string]$headers['x-sinbad-argos-requested-at'];workspaceId=[string]$config.workspaceId}
    $random=[byte[]]::new(32);$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($random) } finally { $rng.Dispose() }
    $challenge=([BitConverter]::ToString($random)).Replace('-','').ToLowerInvariant()
    $request=@{command=$command;stepUp=@{authorizationId=$id;nonce=$nonce};challenge=$challenge} | ConvertTo-Json -Compress -Depth 6
    $result=Invoke-ArgosOwnerService $config $auth $request
    if ($result.ok -ne $true -or $result.challenge -cne $challenge -or $result.authorizationId -cne $id -or $result.instanceId -cne $config.instanceId -or $result.bodySha256 -cne $command.bodySha256 -or $result.commandHash -cnotmatch '^[0-9a-f]{64}$') { return @{admitted=$false;reason='BRIDGE_OWNER_RESPONSE_INVALID'} }
    return @{admitted=$true}
  } catch { return @{admitted=$false;reason='BRIDGE_OWNER_APPROVAL_REJECTED'} }
}

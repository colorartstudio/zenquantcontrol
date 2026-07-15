$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$envMap = Get-ProjectEnvMap -ProjectRoot $projectRoot
$workerToken = if ($envMap.ContainsKey('WORKER_INTERNAL_TOKEN') -and -not [string]::IsNullOrWhiteSpace([string]$envMap['WORKER_INTERNAL_TOKEN'])) {
  [string]$envMap['WORKER_INTERNAL_TOKEN']
} elseif ($envMap.ContainsKey('AUTOMATION_API_TOKEN')) {
  [string]$envMap['AUTOMATION_API_TOKEN']
} else {
  ''
}

function Show-RequestResult {
  param(
    [string]$Label,
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  Write-Host ''
  Write-Host "[$Label] $Url"

  try {
    $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec 20
    Write-Host $response.Content
  } catch {
    Write-Host $_.Exception.Message
  }
}

Show-RequestResult -Label 'API local' -Url 'http://127.0.0.1:4174/api/health'

if ($workerToken) {
  Show-RequestResult -Label 'Worker local' -Url 'http://127.0.0.1:4175/internal/health' -Headers @{ 'x-worker-token' = $workerToken }
}

if ($envMap.ContainsKey('CLOUDFLARE_TUNNEL_HOSTNAME') -and -not [string]::IsNullOrWhiteSpace([string]$envMap['CLOUDFLARE_TUNNEL_HOSTNAME'])) {
  $hostname = [string]$envMap['CLOUDFLARE_TUNNEL_HOSTNAME']
  Show-RequestResult -Label 'API publica' -Url "https://$hostname/api/health"
}

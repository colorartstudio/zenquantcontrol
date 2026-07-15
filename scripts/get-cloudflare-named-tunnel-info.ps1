$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$settings = Get-CloudflareNamedTunnelSettings -ProjectRoot $projectRoot

if (-not (Test-Path $settings.InfoPath)) {
  throw 'Named tunnel ainda nao foi criado.'
}

Get-Content $settings.InfoPath

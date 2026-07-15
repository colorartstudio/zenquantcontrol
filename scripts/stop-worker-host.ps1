$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'
$pm2 = Join-Path $nodeModulesBin 'pm2.cmd'

if (Test-Path (Join-Path $PSScriptRoot 'stop-cloudflare-tunnel.ps1')) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop-cloudflare-tunnel.ps1')
}

if (-not (Test-Path $pm2)) {
  Write-Host 'PM2 local nao encontrado. Nada para parar no PM2.'
  exit 0
}

Set-Location $projectRoot
$env:Path = "$nodeModulesBin;$env:Path"

& $pm2 delete zenquant-api
& $pm2 delete zenquant-worker
& $pm2 save

Write-Host 'API e worker foram encerrados.'

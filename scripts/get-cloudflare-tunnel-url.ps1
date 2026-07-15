$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$urlFile = Join-Path $projectRoot '.runtime\cloudflared-url.txt'

if (-not (Test-Path $urlFile)) {
  throw 'Nenhuma URL de tunnel foi registrada ainda. Rode npm run tunnel:api primeiro.'
}

Get-Content $urlFile | Select-Object -First 1

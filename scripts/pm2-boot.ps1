$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'

Set-Location $projectRoot

if (-not (Test-Path (Join-Path $nodeModulesBin 'pm2.cmd'))) {
  throw 'PM2 local nao encontrado. Rode npm install no projeto antes de instalar o startup.'
}

$env:Path = "$nodeModulesBin;$env:Path"

& (Join-Path $nodeModulesBin 'pm2.cmd') resurrect

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao restaurar processos do PM2. Codigo: $LASTEXITCODE"
}

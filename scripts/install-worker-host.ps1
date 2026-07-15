$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'
$envPath = Join-Path $projectRoot '.env'

function Get-NpmCommand {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
  }

  if (-not $npm) {
    throw 'npm nao encontrado. Instale o Node.js LTS antes de continuar.'
  }

  return $npm.Source
}

function Get-BrowserExecutablePath {
  $edge = Get-Command msedge.exe -ErrorAction SilentlyContinue
  $chrome = Get-Command chrome.exe -ErrorAction SilentlyContinue

  $candidates = @(
    $edge.Source,
    $chrome.Source,
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  ) | Where-Object { $_ }

  $resolved = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $resolved) {
    throw 'Nenhum Chrome/Edge foi encontrado. Instale um navegador nessa maquina worker.'
  }

  return $resolved
}

function Get-EnvTemplatePath {
  $candidates = @(
    (Join-Path $projectRoot '.env.example'),
    (Join-Path $projectRoot 'deployment\windows-worker\.env.example')
  )

  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Test-PlaceholderValue {
  param(
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }

  return $Value -match 'COLE_AQUI|DEFINA_|SEU-PROJETO|CHANGE_ME|<'
}

function Test-RequiredEnvConfigured {
  param(
    [hashtable]$EnvMap,
    [string[]]$RequiredKeys
  )

  foreach ($key in $RequiredKeys) {
    if (-not $EnvMap.ContainsKey($key)) {
      return $false
    }

    if (Test-PlaceholderValue -Value ([string]$EnvMap[$key])) {
      return $false
    }
  }

  return $true
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js nao encontrado. Instale o Node.js LTS antes de continuar.'
}

$npm = Get-NpmCommand
$browserPath = Get-BrowserExecutablePath
$cloudflaredPath = Get-CloudflaredPath

Write-Host "Navegador detectado em: $browserPath"
Write-Host "cloudflared detectado em: $cloudflaredPath"

if (-not (Test-Path $envPath)) {
  $templatePath = Get-EnvTemplatePath
  if (-not $templatePath) {
    throw 'Nenhum .env.example foi encontrado para inicializar a maquina worker.'
  }

  Copy-Item $templatePath $envPath -Force
  Write-Host 'Arquivo .env criado a partir do modelo. Preencha os valores reais antes da primeira subida completa.'
}

Set-Location $projectRoot
& $npm install
if ($LASTEXITCODE -ne 0) {
  throw "Falha no npm install. Codigo: $LASTEXITCODE"
}

$envMap = Get-ProjectEnvMap -ProjectRoot $projectRoot
$requiredKeys = @(
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTOMATION_API_TOKEN'
)

if (-not (Test-RequiredEnvConfigured -EnvMap $envMap -RequiredKeys $requiredKeys)) {
  Write-Host ''
  Write-Host 'Dependencias instaladas, mas o .env ainda precisa ser preenchido.'
  Write-Host "Edite o arquivo: $envPath"
  Write-Host 'Depois rode: powershell -ExecutionPolicy Bypass -File .\scripts\start-worker-host.ps1'
  exit 0
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-worker-host.ps1')
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao iniciar API/worker. Codigo: $LASTEXITCODE"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install-pm2-startup.ps1')
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao configurar o startup automatico. Codigo: $LASTEXITCODE"
}

Write-Host ''
Write-Host 'Maquina worker instalada com sucesso.'
Write-Host 'Voce pode fechar o terminal; PM2 e startup automatico ficaram configurados.'

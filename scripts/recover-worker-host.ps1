$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$envMap = Get-ProjectEnvMap -ProjectRoot $projectRoot

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Body = $null
  )

  $params = @{
    Method = $Method
    Uri = $Url
    UseBasicParsing = $true
    TimeoutSec = 30
    Headers = @{ 'Content-Type' = 'application/json' }
  }

  if ($null -ne $Body) {
    $params.Body = $Body
  }

  $response = Invoke-WebRequest @params
  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }

  return $response.Content | ConvertFrom-Json
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-worker-host.ps1')
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao iniciar a stack local. Codigo: $LASTEXITCODE"
}

$healthUrl = 'http://127.0.0.1:4174/api/health'
$healthOk = $false

for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  try {
    $health = Invoke-JsonRequest -Method 'GET' -Url $healthUrl
    if ($health.ok) {
      $healthOk = $true
      break
    }
  } catch {
  }

  Start-Sleep -Seconds 2
}

if (-not $healthOk) {
  throw "A API nao ficou saudavel em tempo habil: $healthUrl"
}

$accounts = Invoke-JsonRequest -Method 'GET' -Url 'http://127.0.0.1:4174/api/contas'
$reconnectableAccounts = @($accounts | Where-Object { $_.credencial_configurada -eq $true })

foreach ($account in $reconnectableAccounts) {
  Write-Host "Iniciando reconexao de $($account.apelido)..."
  Invoke-JsonRequest -Method 'POST' -Url "http://127.0.0.1:4174/api/contas/$($account.id)/connect" -Body '{}'
}

$panelUrl = if ($envMap.ContainsKey('WORKER_PANEL_URL') -and -not [string]::IsNullOrWhiteSpace([string]$envMap['WORKER_PANEL_URL'])) {
  [string]$envMap['WORKER_PANEL_URL']
} else {
  ''
}

Write-Host ''
Write-Host 'Recuperacao da maquina worker iniciada com sucesso.'
Write-Host "Health local: $healthUrl"

if ($reconnectableAccounts.Count -gt 0) {
  Write-Host "Reconexao enviada para $($reconnectableAccounts.Count) conta(s)."
}

if ($panelUrl) {
  Write-Host "Abrindo painel: $panelUrl"
  Start-Process $panelUrl | Out-Null
} else {
  Write-Host 'WORKER_PANEL_URL nao configurada no .env. Nenhum painel foi aberto automaticamente.'
}

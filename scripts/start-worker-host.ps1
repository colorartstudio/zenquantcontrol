$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'
$pm2 = Join-Path $nodeModulesBin 'pm2.cmd'

function Test-PlaceholderValue {
  param(
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }

  return $Value -match 'COLE_AQUI|DEFINA_|SEU-PROJETO|CHANGE_ME|<'
}

function Assert-ConfiguredValue {
  param(
    [hashtable]$EnvMap,
    [string]$Key
  )

  if (-not $EnvMap.ContainsKey($Key) -or (Test-PlaceholderValue -Value ([string]$EnvMap[$Key]))) {
    throw "Preencha a variavel $Key no .env antes de iniciar a maquina worker."
  }
}

function Test-Pm2ProcessExists {
  param(
    [string]$Pm2Path,
    [string]$Name
  )

  $json = & $Pm2Path jlist 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($json)) {
    return $false
  }

  try {
    $list = $json | ConvertFrom-Json
  } catch {
    return $false
  }

  return [bool]($list | Where-Object { $_.name -eq $Name })
}

if (-not (Test-Path $pm2)) {
  throw 'PM2 local nao encontrado. Rode primeiro o install-worker-host.ps1.'
}

$envMap = Get-ProjectEnvMap -ProjectRoot $projectRoot
Assert-ConfiguredValue -EnvMap $envMap -Key 'VITE_SUPABASE_URL'
Assert-ConfiguredValue -EnvMap $envMap -Key 'SUPABASE_SERVICE_ROLE_KEY'
Assert-ConfiguredValue -EnvMap $envMap -Key 'AUTOMATION_API_TOKEN'

Set-Location $projectRoot
$env:Path = "$nodeModulesBin;$env:Path"

if (Test-Pm2ProcessExists -Pm2Path $pm2 -Name 'zenquant-api') {
  & $pm2 restart zenquant-api --update-env
} else {
  & $pm2 start ecosystem.config.cjs --only zenquant-api --update-env
}

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao subir zenquant-api. Codigo: $LASTEXITCODE"
}

if (Test-Pm2ProcessExists -Pm2Path $pm2 -Name 'zenquant-worker') {
  & $pm2 restart zenquant-worker --update-env
} else {
  & $pm2 start ecosystem.config.cjs --only zenquant-worker --update-env
}

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao subir zenquant-worker. Codigo: $LASTEXITCODE"
}

& $pm2 save
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao salvar o dump do PM2. Codigo: $LASTEXITCODE"
}

$settings = Get-CloudflareNamedTunnelSettings -ProjectRoot $projectRoot
$hasTunnelToken = -not (Test-PlaceholderValue -Value ([string]$settings.TunnelToken))

if ($hasTunnelToken) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-cloudflare-named-tunnel.ps1')
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao iniciar o Cloudflare Tunnel. Codigo: $LASTEXITCODE"
  }
} else {
  Write-Host 'Cloudflare Tunnel nao iniciado porque o token ainda nao foi preenchido no .env.'
}

Write-Host ''
Write-Host 'Stack worker iniciada com sucesso.'
Write-Host 'Health local: http://127.0.0.1:4174/api/health'

if (-not [string]::IsNullOrWhiteSpace([string]$settings.Hostname)) {
  Write-Host "Health publico: https://$($settings.Hostname)/api/health"
}

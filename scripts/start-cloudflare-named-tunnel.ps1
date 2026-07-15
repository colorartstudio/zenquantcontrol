$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$settings = Get-CloudflareNamedTunnelSettings -ProjectRoot $projectRoot
$cloudflaredPath = Get-CloudflaredPath

Ensure-CloudflareLogin -CertPath $settings.CertPath

if (-not (Test-Path $settings.InfoPath) -or -not (Test-Path $settings.ConfigPath)) {
  throw 'Named tunnel ainda nao foi criado. Rode npm run tunnel:fixed:create primeiro.'
}

New-Item -ItemType Directory -Path $settings.RuntimeDir -Force | Out-Null

if (Test-Path $settings.PidFile) {
  try {
    $existingPid = Get-Content $settings.PidFile | Select-Object -First 1
    if ($existingPid) {
      Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    }
  } catch {
  }
}

Remove-Item $settings.LogFile -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $cloudflaredPath -ArgumentList @(
  'tunnel',
  '--config', $settings.ConfigPath,
  '--no-autoupdate',
  '--logfile', $settings.LogFile,
  '--loglevel', 'info',
  'run'
) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

$process.Id | Set-Content $settings.PidFile

for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Seconds 1
  if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    throw 'cloudflared named tunnel encerrou ao iniciar.'
  }
}

$info = Get-Content $settings.InfoPath -Raw | ConvertFrom-Json
Write-Host "Named tunnel ativo em: https://$($info.hostname)"

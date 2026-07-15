$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'cloudflared.pid'
$logFile = Join-Path $runtimeDir 'cloudflared.log'
$urlFile = Join-Path $runtimeDir 'cloudflared-url.txt'
$targetUrl = 'http://127.0.0.1:4174'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (Test-Path $pidFile) {
  try {
    $existingPid = Get-Content $pidFile | Select-Object -First 1
    if ($existingPid) {
      Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    }
  } catch {
  }
}

Remove-Item $logFile -ErrorAction SilentlyContinue
Remove-Item $urlFile -ErrorAction SilentlyContinue

$cloudflaredCandidates = @(
  (Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  'C:\Program Files\cloudflared\cloudflared.exe',
  'C:\Program Files (x86)\cloudflared\cloudflared.exe'
) | Where-Object { $_ }

$cloudflaredPath = $cloudflaredCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cloudflaredPath) {
  throw 'cloudflared nao encontrado no PATH nem nos caminhos padrao do Windows.'
}

$process = Start-Process -FilePath $cloudflaredPath -ArgumentList @(
  'tunnel',
  '--url', $targetUrl,
  '--no-autoupdate',
  '--logfile', $logFile,
  '--loglevel', 'info'
) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

$process.Id | Set-Content $pidFile

$publicUrl = $null
for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
  Start-Sleep -Seconds 1

  if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    throw 'cloudflared encerrou antes de publicar o tunel.'
  }

  if (Test-Path $logFile) {
    $logContent = Get-Content $logFile -Raw
    $match = [regex]::Match($logContent, 'https://[-a-z0-9]+\.trycloudflare\.com')
    if ($match.Success) {
      $publicUrl = $match.Value
      break
    }
  }
}

if (-not $publicUrl) {
  throw 'Nao foi possivel obter a URL publica do Cloudflare Tunnel.'
}

$publicUrl | Set-Content $urlFile
Write-Host "Cloudflare Tunnel ativo em: $publicUrl"

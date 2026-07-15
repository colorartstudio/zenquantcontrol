$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'cloudflared.pid'
$namedPidFile = Join-Path $runtimeDir 'cloudflared-named.pid'

function Stop-CloudflaredByPidFile {
  param(
    [string]$TargetPidFile
  )

  if (-not (Test-Path $TargetPidFile)) {
    return $false
  }

  $pid = Get-Content $TargetPidFile | Select-Object -First 1

  if ($pid) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }

  Remove-Item $TargetPidFile -ErrorAction SilentlyContinue
  return $true
}

$stopped = $false
$stopped = (Stop-CloudflaredByPidFile -TargetPidFile $pidFile) -or $stopped
$stopped = (Stop-CloudflaredByPidFile -TargetPidFile $namedPidFile) -or $stopped

if (-not $stopped) {
  Write-Host 'Nenhum tunnel em execucao encontrado.'
  exit 0
}

Remove-Item (Join-Path $runtimeDir 'cloudflared-url.txt') -ErrorAction SilentlyContinue
Remove-Item (Join-Path $runtimeDir 'cloudflared-named.log') -ErrorAction SilentlyContinue

Write-Host 'Cloudflare Tunnel encerrado.'

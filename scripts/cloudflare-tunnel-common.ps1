$ErrorActionPreference = 'Stop'

function Get-CloudflaredPath {
  $candidates = @(
    (Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    'C:\Program Files\cloudflared\cloudflared.exe',
    'C:\Program Files (x86)\cloudflared\cloudflared.exe'
  ) | Where-Object { $_ }

  $resolved = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $resolved) {
    throw 'cloudflared nao encontrado no PATH nem nos caminhos padrao do Windows.'
  }

  return $resolved
}

function Get-CloudflareNamedTunnelSettings {
  param(
    [string]$ProjectRoot
  )

  $tunnelName = if ($env:CLOUDFLARE_TUNNEL_NAME) { $env:CLOUDFLARE_TUNNEL_NAME } else { 'zenquantcontrol-api' }
  $hostname = if ($env:CLOUDFLARE_TUNNEL_HOSTNAME) { $env:CLOUDFLARE_TUNNEL_HOSTNAME } else { '' }
  $originUrl = if ($env:CLOUDFLARE_TUNNEL_ORIGIN_URL) { $env:CLOUDFLARE_TUNNEL_ORIGIN_URL } else { 'http://127.0.0.1:4174' }
  $runtimeDir = Join-Path $ProjectRoot '.runtime'
  $configPath = Join-Path $runtimeDir 'cloudflared-named.yml'
  $infoPath = Join-Path $runtimeDir 'cloudflared-named-info.json'
  $pidFile = Join-Path $runtimeDir 'cloudflared-named.pid'
  $logFile = Join-Path $runtimeDir 'cloudflared-named.log'
  $certPath = Join-Path $env:USERPROFILE '.cloudflared\cert.pem'

  return @{
    TunnelName = $tunnelName
    Hostname = $hostname
    OriginUrl = $originUrl
    RuntimeDir = $runtimeDir
    ConfigPath = $configPath
    InfoPath = $infoPath
    PidFile = $pidFile
    LogFile = $logFile
    CertPath = $certPath
  }
}

function Ensure-CloudflareLogin {
  param(
    [string]$CertPath
  )

  if (-not (Test-Path $CertPath)) {
    throw "Certificado do Cloudflare nao encontrado em $CertPath. Rode npm run tunnel:login e aprove o dominio na Cloudflare."
  }
}

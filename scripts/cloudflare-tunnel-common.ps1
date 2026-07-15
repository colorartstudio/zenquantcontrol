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

function Get-ProjectEnvMap {
  param(
    [string]$ProjectRoot
  )

  $envFilePath = Join-Path $ProjectRoot '.env'
  $values = @{}

  if (-not (Test-Path $envFilePath)) {
    return $values
  }

  foreach ($line in Get-Content $envFilePath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()

    if ($value.Length -ge 2) {
      $quotedWithDouble = $value.StartsWith('"') -and $value.EndsWith('"')
      $quotedWithSingle = $value.StartsWith("'") -and $value.EndsWith("'")

      if ($quotedWithDouble -or $quotedWithSingle) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    $values[$key] = $value
  }

  return $values
}

function Get-SettingValue {
  param(
    [hashtable]$ProjectEnv,
    [string]$Name,
    [string]$DefaultValue = ''
  )

  $envItem = Get-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
  if ($envItem -and -not [string]::IsNullOrWhiteSpace([string]$envItem.Value)) {
    return [string]$envItem.Value
  }

  if ($ProjectEnv.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$ProjectEnv[$Name])) {
    return [string]$ProjectEnv[$Name]
  }

  return $DefaultValue
}

function Get-CloudflareNamedTunnelSettings {
  param(
    [string]$ProjectRoot
  )

  $projectEnv = Get-ProjectEnvMap -ProjectRoot $ProjectRoot
  $tunnelName = Get-SettingValue -ProjectEnv $projectEnv -Name 'CLOUDFLARE_TUNNEL_NAME' -DefaultValue 'zenquantcontrol-api'
  $hostname = Get-SettingValue -ProjectEnv $projectEnv -Name 'CLOUDFLARE_TUNNEL_HOSTNAME'
  $originUrl = Get-SettingValue -ProjectEnv $projectEnv -Name 'CLOUDFLARE_TUNNEL_ORIGIN_URL' -DefaultValue 'http://127.0.0.1:4174'
  $tunnelToken = (Get-SettingValue -ProjectEnv $projectEnv -Name 'CLOUDFLARE_TUNNEL_TOKEN').Trim()
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
    TunnelToken = $tunnelToken
    RuntimeDir = $runtimeDir
    ConfigPath = $configPath
    InfoPath = $infoPath
    PidFile = $pidFile
    LogFile = $logFile
    CertPath = $certPath
  }
}

function Test-HasCloudflareTunnelToken {
  param(
    [hashtable]$Settings
  )

  return -not [string]::IsNullOrWhiteSpace($Settings.TunnelToken)
}

function Ensure-CloudflareLogin {
  param(
    [string]$CertPath
  )

  if (-not (Test-Path $CertPath)) {
    throw "Certificado do Cloudflare nao encontrado em $CertPath. Rode npm run tunnel:login e aprove o dominio na Cloudflare."
  }
}

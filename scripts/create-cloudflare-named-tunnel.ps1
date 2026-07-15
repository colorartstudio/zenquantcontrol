$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$projectRoot = Split-Path -Parent $PSScriptRoot
$settings = Get-CloudflareNamedTunnelSettings -ProjectRoot $projectRoot
$cloudflaredPath = Get-CloudflaredPath

if (-not $settings.Hostname) {
  throw 'Defina CLOUDFLARE_TUNNEL_HOSTNAME no ambiente, por exemplo api.seudominio.com, antes de criar o tunnel fixo.'
}

New-Item -ItemType Directory -Path $settings.RuntimeDir -Force | Out-Null

$usingToken = Test-HasCloudflareTunnelToken -Settings $settings

if ($usingToken) {
  @{
    tunnelName = $settings.TunnelName
    hostname = $settings.Hostname
    originUrl = $settings.OriginUrl
    authMode = 'token'
    createdVia = 'cloudflare-dashboard'
  } | ConvertTo-Json | Set-Content $settings.InfoPath

  Write-Host 'Modo token detectado. Crie o tunnel e o DNS no painel da Cloudflare, salve o Tunnel Token em CLOUDFLARE_TUNNEL_TOKEN e depois rode npm run tunnel:fixed:start.'
  Write-Host "Arquivo local atualizado em: $($settings.InfoPath)"
  exit 0
}

Ensure-CloudflareLogin -CertPath $settings.CertPath

$existingInfo = $null
if (Test-Path $settings.InfoPath) {
  try {
    $existingInfo = Get-Content $settings.InfoPath -Raw | ConvertFrom-Json
  } catch {
  }
}

if (-not $existingInfo) {
  $createOutput = & $cloudflaredPath tunnel create $settings.TunnelName --output json 2>&1
  $createText = ($createOutput | Out-String).Trim()
  $createJson = $createText | ConvertFrom-Json
  $existingInfo = [pscustomobject]@{
    tunnelName = $settings.TunnelName
    tunnelId = $createJson.id
    credentialsFile = $createJson.credentials_file
    hostname = $settings.Hostname
    originUrl = $settings.OriginUrl
  }
} else {
  $existingInfo.hostname = $settings.Hostname
  $existingInfo.originUrl = $settings.OriginUrl
}

if (-not $existingInfo.credentialsFile) {
  throw 'Nao foi possivel determinar o arquivo de credenciais do named tunnel.'
}

& $cloudflaredPath tunnel route dns $settings.TunnelName $settings.Hostname 2>&1 | Out-String | Write-Host

$configContent = @"
tunnel: $($existingInfo.tunnelId)
credentials-file: $($existingInfo.credentialsFile)

ingress:
  - hostname: $($settings.Hostname)
    service: $($settings.OriginUrl)
  - service: http_status:404
"@

$configContent | Set-Content $settings.ConfigPath
$existingInfo | ConvertTo-Json | Set-Content $settings.InfoPath

Write-Host "Named tunnel pronto: $($settings.Hostname)"

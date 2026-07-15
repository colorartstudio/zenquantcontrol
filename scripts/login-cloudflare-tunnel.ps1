$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'cloudflare-tunnel-common.ps1')

$cloudflaredPath = Get-CloudflaredPath
& $cloudflaredPath tunnel login

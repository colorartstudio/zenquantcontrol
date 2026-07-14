$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'
$taskName = 'ZenQuantControlPM2'
$runEntryName = 'ZenQuantControlPM2'
$pm2 = Join-Path $nodeModulesBin 'pm2.cmd'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$runKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $runKeyPath -Name $runEntryName -ErrorAction SilentlyContinue

if (Test-Path $pm2) {
  Set-Location $projectRoot
  $env:Path = "$nodeModulesBin;$env:Path"
  & $pm2 delete all
  & $pm2 save --force
}

Write-Host 'Startup PM2 removido.'

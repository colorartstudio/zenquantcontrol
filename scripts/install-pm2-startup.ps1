$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModulesBin = Join-Path $projectRoot 'node_modules\.bin'
$taskName = 'ZenQuantControlPM2'
$runEntryName = 'ZenQuantControlPM2'
$bootScript = Join-Path $PSScriptRoot 'pm2-boot.ps1'
$pm2 = Join-Path $nodeModulesBin 'pm2.cmd'

if (-not (Test-Path $pm2)) {
  throw 'PM2 local nao encontrado. Rode npm install antes.'
}

Set-Location $projectRoot
$env:Path = "$nodeModulesBin;$env:Path"

& $pm2 start ecosystem.config.cjs --update-env
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao iniciar processos no PM2. Codigo: $LASTEXITCODE"
}

& $pm2 save
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao salvar dump do PM2. Codigo: $LASTEXITCODE"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$bootScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Restaura os processos PM2 do ZenQuantControl no logon.' -Force | Out-Null
  Write-Host "Startup PM2 configurado com sucesso. Tarefa registrada: $taskName"
} catch {
  $runKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  $runValue = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$bootScript`""
  New-ItemProperty -Path $runKeyPath -Name $runEntryName -Value $runValue -PropertyType String -Force | Out-Null
  Write-Host "Sem permissao para criar tarefa agendada. Fallback aplicado no Registro do usuario: $runEntryName"
}

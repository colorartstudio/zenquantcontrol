$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactsRoot = Join-Path $projectRoot '.artifacts\windows-worker-package'
$stageRoot = Join-Path $artifactsRoot 'control-zen-quant-worker'
$zipPath = Join-Path $artifactsRoot 'control-zen-quant-worker.zip'

function Copy-PathToStage {
  param(
    [string]$RelativePath
  )

  $sourcePath = Join-Path $projectRoot $RelativePath
  $targetPath = Join-Path $stageRoot $RelativePath
  $targetParent = Split-Path -Parent $targetPath

  if (-not (Test-Path $sourcePath)) {
    throw "Caminho nao encontrado para empacotar: $RelativePath"
  }

  New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
  Copy-Item $sourcePath $targetPath -Recurse -Force
}

Remove-Item $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

$pathsToCopy = @(
  'package.json',
  'package-lock.json',
  'ecosystem.config.cjs',
  'server',
  'worker',
  'scripts'
)

foreach ($relativePath in $pathsToCopy) {
  Copy-PathToStage -RelativePath $relativePath
}

Copy-Item (Join-Path $projectRoot 'deployment\windows-worker\README.md') (Join-Path $stageRoot 'README-WORKER.md') -Force
Copy-Item (Join-Path $projectRoot 'deployment\windows-worker\.env.example') (Join-Path $stageRoot '.env.example') -Force
Copy-Item (Join-Path $projectRoot 'deployment\windows-worker\.env.production.example') (Join-Path $stageRoot '.env.production.example') -Force

$archiveItems = Get-ChildItem -Force $stageRoot | Select-Object -ExpandProperty FullName
Compress-Archive -Path $archiveItems -DestinationPath $zipPath -Force

Write-Host "Pacote Windows gerado em: $zipPath"

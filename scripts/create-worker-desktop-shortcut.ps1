$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath('Desktop')
$cmdPath = Join-Path $PSScriptRoot 'recover-worker-host.cmd'
$iconPath = Join-Path $projectRoot 'deployment\windows-worker\zenquant-worker.ico'
$shortcutName = 'ZENQUANT ON.lnk'
$shortcutPath = Join-Path $desktopPath $shortcutName
$legacyShortcutPaths = @(
  (Join-Path $desktopPath 'Ligar ZenQuant Worker.lnk'),
  (Join-Path $desktopPath 'Ligar ZenQuant.lnk')
)

if (-not (Test-Path $cmdPath)) {
  throw "Arquivo de recuperacao nao encontrado: $cmdPath"
}

function Ensure-WorkerIcon {
  param(
    [string]$TargetPath
  )

  if (Test-Path $TargetPath) {
    return
  }

  Add-Type -AssemblyName System.Drawing
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeIconMethods {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

  $parentDir = Split-Path -Parent $TargetPath
  New-Item -ItemType Directory -Path $parentDir -Force | Out-Null

  $bitmap = New-Object System.Drawing.Bitmap 256, 256
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(18, 92, 53))

  $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
  $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 200, 46))
  $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
  $textBrush = [System.Drawing.Brushes]::White
  $font = New-Object System.Drawing.Font('Segoe UI', 92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $smallFont = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $stringFormat = New-Object System.Drawing.StringFormat
  $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

  $graphics.FillEllipse($shadowBrush, 18, 18, 220, 220)
  $graphics.FillEllipse($cardBrush, 8, 8, 220, 220)
  $graphics.FillRectangle($accentBrush, 148, 28, 56, 18)
  $graphics.DrawString('Z', $font, $textBrush, (New-Object System.Drawing.RectangleF(0, 18, 236, 132)), $stringFormat)
  $graphics.DrawString('WORKER', $smallFont, $textBrush, (New-Object System.Drawing.RectangleF(0, 148, 236, 44)), $stringFormat)

  $iconHandle = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
  $fileStream = [System.IO.File]::Create($TargetPath)
  $icon.Save($fileStream)
  $fileStream.Close()

  $graphics.Dispose()
  $bitmap.Dispose()
  $icon.Dispose()
  $font.Dispose()
  $smallFont.Dispose()
  $shadowBrush.Dispose()
  $cardBrush.Dispose()
  $accentBrush.Dispose()
  $stringFormat.Dispose()
  [void][NativeIconMethods]::DestroyIcon($iconHandle)
}

Ensure-WorkerIcon -TargetPath $iconPath

foreach ($legacyShortcutPath in $legacyShortcutPaths) {
  if ($legacyShortcutPath -ne $shortcutPath -and (Test-Path $legacyShortcutPath)) {
    Remove-Item $legacyShortcutPath -Force -ErrorAction SilentlyContinue
  }
}

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $cmdPath
$shortcut.WorkingDirectory = Split-Path -Parent $cmdPath
$shortcut.IconLocation = "$iconPath,0"
$shortcut.WindowStyle = 7
$shortcut.Description = 'Liga a stack ZenQuant Worker, reconecta as contas e abre o painel.'
$shortcut.Save()

Write-Host "Atalho criado em: $shortcutPath"
Write-Host "Icone criado em: $iconPath"

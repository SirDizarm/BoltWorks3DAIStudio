param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "3DModelStudio")
)

$ErrorActionPreference = "Stop"

$installRoot = [IO.Path]::GetFullPath($InstallDir)
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "BoltWorks 3D AI Studio.lnk"
$startMenuShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\BoltWorks 3D AI Studio.lnk"
$progId = "ModelStudio.Project"

if (Test-Path $desktopShortcut) { Remove-Item $desktopShortcut -Force }
if (Test-Path $startMenuShortcut) { Remove-Item $startMenuShortcut -Force }
if (Test-Path "HKCU:\Software\Classes\.modelerproj") { Remove-Item "HKCU:\Software\Classes\.modelerproj" -Recurse -Force }
if (Test-Path "HKCU:\Software\Classes\$progId") { Remove-Item "HKCU:\Software\Classes\$progId" -Recurse -Force }
if (Test-Path $installRoot) { Remove-Item $installRoot -Recurse -Force }

Write-Host "Removed BoltWorks 3D AI Studio from $installRoot"

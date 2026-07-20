param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "3DModelStudio"),
  [switch]$DesktopShortcut = $true,
  [switch]$StartMenuShortcut = $true
)

$ErrorActionPreference = "Stop"

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$installRoot = [IO.Path]::GetFullPath($InstallDir)
$desktopPath = [Environment]::GetFolderPath("Desktop")
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcutTarget = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcutArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$installRoot\windows\Launch-3D-Model-Studio.ps1`""
$shortcutIcon = "$env:SystemRoot\System32\SHELL32.dll,137"
$progId = "ModelStudio.Project"

Write-Host "Installing BoltWorks 3D AI Studio to $installRoot"
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

Get-ChildItem -LiteralPath $sourceRoot -Force | ForEach-Object {
  if ($_.Name -in @("server.log", "server.err.log")) { return }
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $installRoot $_.Name) -Recurse -Force
}

function New-Shortcut {
  param(
    [string]$Path,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$Arguments = "",
    [string]$IconLocation = ""
  )
  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($Path)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  if ($Arguments) { $shortcut.Arguments = $Arguments }
  if ($IconLocation) { $shortcut.IconLocation = $IconLocation }
  $shortcut.Save()
}

if ($DesktopShortcut) {
  New-Shortcut -Path (Join-Path $desktopPath "BoltWorks 3D AI Studio.lnk") -TargetPath $shortcutTarget -WorkingDirectory $installRoot -Arguments $shortcutArguments -IconLocation $shortcutIcon
}

if ($StartMenuShortcut) {
  New-Shortcut -Path (Join-Path $startMenuDir "BoltWorks 3D AI Studio.lnk") -TargetPath $shortcutTarget -WorkingDirectory $installRoot -Arguments $shortcutArguments -IconLocation $shortcutIcon
}

$openCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$installRoot\windows\Launch-3D-Model-Studio.ps1`" `"%1`""
New-Item -Path "HKCU:\Software\Classes\.modelerproj" -Force | Out-Null
Set-Item -Path "HKCU:\Software\Classes\.modelerproj" -Value $progId
New-Item -Path "HKCU:\Software\Classes\$progId" -Force | Out-Null
Set-Item -Path "HKCU:\Software\Classes\$progId" -Value "BoltWorks 3D AI Studio Project"
New-Item -Path "HKCU:\Software\Classes\$progId\DefaultIcon" -Force | Out-Null
Set-Item -Path "HKCU:\Software\Classes\$progId\DefaultIcon" -Value $shortcutIcon
New-Item -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Force | Out-Null
Set-Item -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Value $openCommand

Write-Host ""
Write-Host "Installed BoltWorks 3D AI Studio."
Write-Host "Launcher: $installRoot\windows\Launch-3D-Model-Studio.ps1"
Write-Host "Project files (.modelerproj) now open with the launcher for this user."

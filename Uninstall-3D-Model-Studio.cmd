@echo off
setlocal
title Uninstall BoltWorks 3D AI Studio
echo This will remove the installed BoltWorks 3D AI Studio from your computer.
echo.
choice /M "Do you want to continue"
if errorlevel 2 exit /b 0
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Uninstall-3D-Model-Studio.ps1"
if errorlevel 1 (
  echo.
  echo Uninstall failed.
  pause
  exit /b 1
)
echo.
echo BoltWorks 3D AI Studio was uninstalled successfully.
pause

@echo off
setlocal
title Update BoltWorks 3D AI Studio
echo Updating BoltWorks 3D AI Studio...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-3D-Model-Studio.ps1"
if errorlevel 1 (
  echo.
  echo Update failed.
  pause
  exit /b 1
)
echo.
echo BoltWorks 3D AI Studio updated successfully.
pause

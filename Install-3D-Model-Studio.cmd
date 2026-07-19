@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-3D-Model-Studio.ps1"
if errorlevel 1 pause

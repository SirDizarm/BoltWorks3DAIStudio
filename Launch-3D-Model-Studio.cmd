@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Launch-3D-Model-Studio.ps1" %*

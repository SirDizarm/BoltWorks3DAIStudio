@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rebuild-And-Push-3D-Model-Studio.ps1"
echo.
if errorlevel 1 (
  echo FAILED - see the messages above. Nothing was pushed if the build or checks failed.
) else (
  echo SUCCESS - bundle rebuilt, checks passed, and GitHub is up to date.
)
pause

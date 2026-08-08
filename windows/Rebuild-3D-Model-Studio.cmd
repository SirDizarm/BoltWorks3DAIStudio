@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rebuild-3D-Model-Studio.ps1"
echo.
if errorlevel 1 (
  echo Rebuild FAILED. See the messages above.
) else (
  echo Rebuild OK. You can now open index.html or run npm start.
)
pause

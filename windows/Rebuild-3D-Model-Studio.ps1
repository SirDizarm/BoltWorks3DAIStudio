param(
  [switch]$Check
)

$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $appRoot

Write-Host "Rebuilding BoltWorks 3D AI Studio bundle in $appRoot"
Write-Host ""

npm run build:studio
if ($LASTEXITCODE -ne 0) {
  throw "npm run build:studio failed with exit code $LASTEXITCODE."
}

if ($Check) {
  Write-Host ""
  Write-Host "Running npm run check..."
  npm run check
  if ($LASTEXITCODE -ne 0) {
    throw "npm run check failed with exit code $LASTEXITCODE."
  }
}

Write-Host ""
Write-Host "Rebuild complete. index.html now matches the current source modules."

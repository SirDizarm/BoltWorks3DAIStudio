param(
  [int]$Port = 4173,
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RuntimeDir = (Join-Path $env:LOCALAPPDATA "3DModelStudio\runtime")
)

$ErrorActionPreference = "Stop"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js is required to run the BoltWorks 3D AI Studio local adapter."
}

$serverScript = Join-Path $Root "tools\server.mjs"
if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) {
  throw "Canonical local adapter not found: $serverScript"
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$env:PORT = [string]$Port
$env:MODELER_PENDING_PROJECT_FILE = Join-Path $RuntimeDir "pending-open-project.json"

Push-Location $Root
try {
  & $node.Source $serverScript
  if ($LASTEXITCODE -ne 0) {
    throw "BoltWorks local adapter stopped with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

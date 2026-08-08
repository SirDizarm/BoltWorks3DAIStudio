$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $appRoot

Write-Host "=== BoltWorks 3D AI Studio: Rebuild + Check + Push ==="
Write-Host "Working in $appRoot"
Write-Host ""

Write-Host "--- Step 1/3: Rebuild bundle (npm run build:studio) ---"
npm run build:studio
if ($LASTEXITCODE -ne 0) {
  throw "npm run build:studio failed with exit code $LASTEXITCODE. Nothing was pushed."
}

Write-Host ""
Write-Host "--- Step 2/3: Run checks (npm run check) ---"
npm run check
if ($LASTEXITCODE -ne 0) {
  throw "npm run check failed with exit code $LASTEXITCODE. Nothing was pushed."
}

Write-Host ""
Write-Host "--- Step 3/3: Push to GitHub ---"

git fetch origin main --quiet

$aheadRaw = git rev-list --count origin/main..HEAD
$ahead = 0
if ($aheadRaw) { $ahead = [int]$aheadRaw.Trim() }

if ($ahead -eq 0) {
  Write-Host "Nothing new to push. Local main already matches origin/main."
} else {
  Write-Host "Pushing $ahead commit(s) to origin/main..."
  git push origin main
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed with exit code $LASTEXITCODE."
  }
  Write-Host "Push complete."
}

Write-Host ""
Write-Host "All done: bundle rebuilt, checks passed, GitHub is up to date."

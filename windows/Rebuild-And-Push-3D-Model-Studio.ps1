$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $appRoot

Write-Host "=== BoltWorks 3D AI Studio: Rebuild + Commit Bundle + Check + Push ==="
Write-Host "Working in $appRoot"
Write-Host ""

Write-Host "--- Step 1/4: Rebuild bundle (npm run build:studio) ---"
npm run build:studio
if ($LASTEXITCODE -ne 0) {
  throw "npm run build:studio failed with exit code $LASTEXITCODE. Nothing was committed or pushed."
}

Write-Host ""
Write-Host "--- Step 2/4: Commit the rebuilt bundle, if it changed ---"

$packageJson = Get-Content (Join-Path $appRoot "package.json") -Raw | ConvertFrom-Json
$bundleRelPath = "app/studio-v$($packageJson.version).js"
$bundleFullPath = Join-Path $appRoot $bundleRelPath

if (-not (Test-Path $bundleFullPath)) {
  throw "Expected build output $bundleRelPath was not found after npm run build:studio. Nothing was committed or pushed."
}

$bundleStatus = git status --porcelain -- $bundleRelPath
if ($bundleStatus) {
  Write-Host "Committing rebuilt bundle: $bundleRelPath"
  git add -- $bundleRelPath
  git commit -m "Rebuild bundle for v$($packageJson.version)"
  if ($LASTEXITCODE -ne 0) {
    throw "git commit for the rebuilt bundle failed. Nothing was pushed."
  }
} else {
  Write-Host "$bundleRelPath is already committed and unchanged. Nothing to commit here."
}

Write-Host ""
Write-Host "--- Step 3/4: Run checks (npm run check) ---"
npm run check
if ($LASTEXITCODE -ne 0) {
  throw "npm run check failed with exit code $LASTEXITCODE. Nothing was pushed."
}

Write-Host ""
Write-Host "--- Step 4/4: Push to GitHub ---"

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
Write-Host "All done: bundle rebuilt, committed if changed, checks passed, GitHub is up to date."

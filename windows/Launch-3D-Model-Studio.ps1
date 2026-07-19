param(
  [string]$ProjectPath = "",
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $env:LOCALAPPDATA "3DModelStudio\runtime"
$pendingProjectFile = Join-Path $runtimeDir "pending-open-project.json"
$serverScript = Join-Path $PSScriptRoot "ModelStudioServer.ps1"
$url = "http://127.0.0.1:$Port/index.html"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Test-ModelStudioServer {
  param([int]$CheckPort)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$CheckPort/__ping" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if ($ProjectPath) {
  $resolvedProject = (Resolve-Path $ProjectPath).Path
  $projectText = [IO.File]::ReadAllText($resolvedProject, [System.Text.Encoding]::UTF8)
  $payload = @{
    fileName = [IO.Path]::GetFileName($resolvedProject)
    text = $projectText
  } | ConvertTo-Json -Depth 6 -Compress
  [IO.File]::WriteAllText($pendingProjectFile, $payload, [System.Text.Encoding]::UTF8)
  $url = "$url?openProject=1"
}

if (-not (Test-ModelStudioServer -CheckPort $Port)) {
  Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $serverScript,
    "-Port", "$Port"
  ) | Out-Null

  $started = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if (Test-ModelStudioServer -CheckPort $Port) {
      $started = $true
      break
    }
  }
  if (-not $started) {
    throw "BoltWorks 3D AI Studio server did not start on port $Port."
  }
}

Start-Process $url | Out-Null

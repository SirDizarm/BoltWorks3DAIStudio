param(
  [int]$Port = 4173,
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RuntimeDir = (Join-Path $env:LOCALAPPDATA "3DModelStudio\runtime")
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$pendingProjectFile = Join-Path $RuntimeDir "pending-open-project.json"
$script:shutdownRequested = $false

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".mjs" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif" = "image/gif"
  ".bmp" = "image/bmp"
  ".ico" = "image/x-icon"
  ".wasm" = "application/wasm"
}

function Send-Text {
  param(
    [Parameter(Mandatory = $true)] $Context,
    [int] $StatusCode = 200,
    [string] $ContentType = "text/plain; charset=utf-8",
    [string] $Text = ""
  )
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.OutputStream.Close()
}

function Send-File {
  param(
    [Parameter(Mandatory = $true)] $Context,
    [Parameter(Mandatory = $true)] [string] $Path
  )
  $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
  $contentType = $mimeTypes[$ext]
  if (-not $contentType) { $contentType = "application/octet-stream" }
  $bytes = [IO.File]::ReadAllBytes($Path)
  $Context.Response.StatusCode = 200
  $Context.Response.ContentType = $contentType
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.OutputStream.Close()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "BoltWorks 3D AI Studio running at http://127.0.0.1:$Port"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      if ($path -eq "/__ping") {
        Send-Text -Context $context -StatusCode 200 -Text "ok"
        continue
      }
      if ($path -eq "/__shutdown") {
        Send-Text -Context $context -StatusCode 200 -ContentType "application/json; charset=utf-8" -Text '{"ok":true,"stopping":true}'
        $script:shutdownRequested = $true
        break
      }
      if ($path -eq "/__modeler/open-project") {
        if (-not (Test-Path $pendingProjectFile)) {
          Send-Text -Context $context -StatusCode 204 -Text ""
          continue
        }
        $text = [IO.File]::ReadAllText($pendingProjectFile, [System.Text.Encoding]::UTF8)
        Remove-Item $pendingProjectFile -Force -ErrorAction SilentlyContinue
        Send-Text -Context $context -StatusCode 200 -ContentType "application/json; charset=utf-8" -Text $text
        continue
      }

      $relative = $path.TrimStart("/").Replace("/", "\")
      if ([string]::IsNullOrWhiteSpace($relative)) {
        $relative = "index.html"
      }
      $candidate = [IO.Path]::GetFullPath((Join-Path $Root $relative))
      if (-not $candidate.StartsWith([IO.Path]::GetFullPath($Root), [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Context $context -StatusCode 403 -Text "Forbidden"
        continue
      }
      if (-not (Test-Path $candidate) -or (Get-Item $candidate) -isnot [IO.FileInfo]) {
        Send-Text -Context $context -StatusCode 404 -Text "Not found"
        continue
      }
      Send-File -Context $context -Path $candidate
    } catch {
      Send-Text -Context $context -StatusCode 500 -Text $_.Exception.Message
    }
    if ($script:shutdownRequested) {
      break
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

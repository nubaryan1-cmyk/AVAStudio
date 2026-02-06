$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..").Path
$outDir = Join-Path $root "_artifacts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zip = Join-Path $outDir "AVASTUDIO_MASTER_CLEAN_$stamp.zip"

$exclude = @(
  "_secrets\",
  ".env.local",
  "token.txt",
  "frontend\node_modules\",
  "frontend\.next\",
  "\bin\",
  "\obj\",
  "\__pycache__\",
  ".git\"
)

$files = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  foreach ($ex in $exclude) {
    if ($rel -like "$ex*" -or $rel -like "*$ex*" -or $rel -eq $ex.TrimEnd("\")) { return $false }
  }
  return $true
}

if (-not $files) { throw "No files to archive (after exclusions)." }

Push-Location $root
try {
  $files.FullName |
    ForEach-Object { $_.Substring($root.Length + 1) } |
    Compress-Archive -DestinationPath $zip -Force
} finally {
  Pop-Location
}

Write-Host "OK: $zip"

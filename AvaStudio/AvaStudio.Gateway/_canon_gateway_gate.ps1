param(
  [string]$GatewayDir = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$forbidden = @(
  '(?i)\benum\b',
  '(?i)ValidateSet\s*\(',
  '(?i)\bState\s*==\s*',
  '(?i)\bswitch\s*\(\s*\w*state\w*\s*\)',
  '(?i)\bIN_QUEUE\b|\bIN_PROGRESS\b|\bCOMPLETED\b|\bFAILED\b|\bCANCELLED\b',
  '(?i)\bprogress\b.*(calc|compute|interpret|percent|percentage|eta)',
  '(?i)\bTrainingJobStatus\b|\bJobStatus\b'
)

$files = Get-ChildItem -Path $GatewayDir -Recurse -File |
  Where-Object { $_.Extension -in @('.cs','.ps1','.psm1','.csproj') }

$violations = @()

foreach ($f in $files) {
  $text = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $text) { continue }
  foreach ($rx in $forbidden) {
    if ($text -match $rx) {
      $violations += [pscustomobject]@{
        File = $f.FullName
        Pattern = $rx
      }
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Host "❌ GATEWAY CANON VIOLATIONS FOUND:" -ForegroundColor Red
  $violations | Sort-Object File, Pattern | Format-Table -AutoSize
  exit 1
}

Write-Host "✅ Gateway canon gate: OK" -ForegroundColor Green

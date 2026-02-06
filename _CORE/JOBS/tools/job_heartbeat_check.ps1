param(
  [Parameter(Mandatory=$true)]
  [string]$JobId,

  [int]$HeartbeatWindowSec = 120,
  [int]$TimeoutSec = 300
)

# === PATH RESOLUTION (ENV-BASED) ===
$AvaRoot = if ($env:AVA_ROOT) { $env:AVA_ROOT } else { $PSScriptRoot | Split-Path -Parent | Split-Path -Parent | Split-Path -Parent }
$logRoot = if ($env:AVA_LOG_ROOT) { $env:AVA_LOG_ROOT } else { Join-Path $AvaRoot "_LOGS" }
$logPath = Join-Path $logRoot "kohya\$JobId.log"
$registry = Join-Path $AvaRoot "_CORE\JOBS\jobs_registry.json"
$writer = Join-Path $AvaRoot "_CORE\JOBS\tools\job_state_writer.ps1"

if (!(Test-Path $logPath)) {
  Write-Host "NO_LOG"
  exit 0
}

$mtime = (Get-Item $logPath).LastWriteTimeUtc
$age = (New-TimeSpan -Start $mtime -End (Get-Date).ToUniversalTime()).TotalSeconds

if ($age -le $HeartbeatWindowSec) {
  Write-Host "ALIVE"
  exit 0
}

if ($age -gt $TimeoutSec) {
  & $writer -JobId $JobId -State FAILED -Reason TIMEOUT_ERROR
  Write-Host "TIMEOUT"
  exit 0
}

Write-Host "STALE"

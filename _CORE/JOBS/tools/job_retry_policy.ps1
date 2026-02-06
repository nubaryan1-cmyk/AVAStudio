param(
    [Parameter(Mandatory=$true)]
    [string]$JobId,

    [int]$MaxRetries = 3
)

# === PATH RESOLUTION (ENV-BASED) ===
$AvaRoot = if ($env:AVA_ROOT) { $env:AVA_ROOT } else { $PSScriptRoot | Split-Path -Parent | Split-Path -Parent | Split-Path -Parent }
$registryPath = Join-Path $AvaRoot "_CORE\JOBS\jobs_registry.json"
$writer = Join-Path $AvaRoot "_CORE\JOBS\tools\job_state_writer.ps1"

$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$job = $registry.jobs | Where-Object { $_.job_id -eq $JobId }

if ($null -eq $job) { exit 1 }

if ($job.retry_count -ge $MaxRetries) {
    & $writer -JobId $JobId -State FAILED -Reason FAILED_FINAL
    exit 0
}

if ($job.reason -in @("EXECUTOR_ERROR","TIMEOUT_ERROR")) {
    # Procedural retry: increment counter and re-queue to IN_QUEUE
    # RETRYING state is PERMANENTLY FORBIDDEN per CANON LAW
    $job.retry_count = [int]$job.retry_count + 1
    $registry | ConvertTo-Json -Depth 6 | Set-Content $registryPath -Encoding UTF8
    & $writer -JobId $JobId -State IN_QUEUE -Reason "RETRY_ATTEMPT"
}

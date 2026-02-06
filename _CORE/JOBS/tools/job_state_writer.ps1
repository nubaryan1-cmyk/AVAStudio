param([string]$Event,
    [Parameter(Mandatory=$true)]
    [string]$JobId,

    [Parameter(Mandatory=$true)]
    [string]$State,

    [string]$Reason = "",
    [string]$JobType = "",
    [string]$Executor = "",
    [string]$Logs = "",
    [string]$Output = "",
    [string]$Checkpoints = ""
)

# === PATH RESOLUTION (ENV-BASED) ===
$AvaRoot = if ($env:AVA_ROOT) { $env:AVA_ROOT } else { $PSScriptRoot | Split-Path -Parent | Split-Path -Parent | Split-Path -Parent }
$registryPath = Join-Path $AvaRoot "_CORE\JOBS\jobs_registry.json"

if (!(Test-Path $registryPath)) {
    $registry = @{
        version = "1.0"
        description = "AVA canonical job registry"
        jobs = @()
    }
} else {
    $registry = Get-Content $registryPath -Raw | ConvertFrom-Json
}

$now = (Get-Date).ToString("o")
$job = $registry.jobs | Where-Object { $_.job_id -eq $JobId }

if ($null -eq $job) {
    $job = [PSCustomObject]@{
        job_id = $JobId
        job_type = $JobType
        state = $State
        reason = $Reason
        created_at = $now
        updated_at = $now
        executor = $Executor
        artifacts = @{
            logs = $Logs
            output = $Output
            checkpoints = $Checkpoints
        }
        retry_count = 0
    }
    $registry.jobs += $job
} else {
    # Retry count handled procedurally in job_retry_policy.ps1
    # RETRYING state is PERMANENTLY FORBIDDEN per CANON LAW

    $job.state = $State
    $job.reason = $Reason
    $job.updated_at = $now

    if ($Executor)   { $job.executor = $Executor }
    if ($Logs)       { $job.artifacts.logs = $Logs }
    if ($Output)     { $job.artifacts.output = $Output }
    if ($Checkpoints){ $job.artifacts.checkpoints = $Checkpoints }
}

$registry | ConvertTo-Json -Depth 6 | Set-Content $registryPath -Encoding UTF8
Write-Host "AVA JOB STATE UPDATED: [$JobId] -> [$State]"

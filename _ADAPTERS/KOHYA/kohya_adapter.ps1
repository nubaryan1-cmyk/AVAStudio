param(
    [Parameter(Mandatory = $true)]
    [string]$JobId,

    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

# ==============================
# AVA KOHYA ADAPTER (CANONICAL)
# ==============================

# === PATH RESOLUTION (ENV-BASED) ===
$AvaRoot = if ($env:AVA_ROOT) { $env:AVA_ROOT } else { $PSScriptRoot | Split-Path -Parent | Split-Path -Parent }
$writer = Join-Path $AvaRoot "_CORE\JOBS\tools\job_state_writer.ps1"

# === LOG BINDING (ENV-BASED) ===
$logRoot = if ($env:AVA_LOG_ROOT) { $env:AVA_LOG_ROOT } else { Join-Path $AvaRoot "_LOGS" }
$logDir  = Join-Path $logRoot "kohya"
$logPath = Join-Path $logDir "$JobId.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType File -Force -Path $logPath | Out-Null
Add-Content $logPath "[$(Get-Date -Format o)] JOB STARTED"
# ============================

# === REPORT RUNNING ===
& $writer -JobId $JobId -Event on_start -Executor "kohya_ss"

# === KOHYA PATH (ENV-BASED) ===
$kohyaRoot = if ($env:AVA_KOHYA_ROOT) { $env:AVA_KOHYA_ROOT } else { "/opt/kohya_ss" }
$kohyaTrainScript = Join-Path $kohyaRoot "sd-scripts/train_network.py"

if (!(Test-Path $kohyaTrainScript)) {
    Add-Content $logPath "[$(Get-Date -Format o)] KOHYA PATH NOT FOUND: $kohyaTrainScript"
    & $writer -JobId $JobId -Event on_error -Reason KOHYA_NOT_FOUND -Logs $logPath
    exit 1
}

try {
    Add-Content $logPath "[$(Get-Date -Format o)] KOHYA LAUNCH: $kohyaTrainScript"

    & python "$kohyaTrainScript" "--config=$ConfigPath" *>> "$logPath"

    if ($LASTEXITCODE -eq 0) {
        Add-Content $logPath "[$(Get-Date -Format o)] JOB COMPLETED"
        & $writer -JobId $JobId -Event on_done -Logs $logPath
    }
    else {
        Add-Content $logPath "[$(Get-Date -Format o)] JOB FAILED (EXIT CODE=$LASTEXITCODE)"
        & $writer -JobId $JobId -Event on_error -Reason EXECUTOR_ERROR -Logs $logPath
    }
}
catch {
    Add-Content $logPath "[$(Get-Date -Format o)] JOB FAILED (EXCEPTION)"
    & $writer -JobId $JobId -Event on_error -Reason SYSTEM_ERROR -Logs $logPath
}

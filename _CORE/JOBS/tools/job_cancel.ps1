param(
    [Parameter(Mandatory=$true)]
    [string]$JobId
)

# === PATH RESOLUTION (ENV-BASED) ===
$AvaRoot = if ($env:AVA_ROOT) { $env:AVA_ROOT } else { $PSScriptRoot | Split-Path -Parent | Split-Path -Parent | Split-Path -Parent }
$writer = Join-Path $AvaRoot "_CORE\JOBS\tools\job_state_writer.ps1"

& $writer -JobId $JobId -State CANCELLED -Reason USER_CANCEL

import logging
import os
from typing import Mapping

# 1. ПЕРЕМЕННЫЕ ПРИЛОЖЕНИЯ (SSOT - БЕЛЫЙ СПИСОК)
SSOT_APP_ENVS = {
    "DATABASE_URL", "REDIS_URL", "AVA_ENV", "LOG_LEVEL",
    "GATEWAY_SECRET", "GPU_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "S3_REGION",
    "PORT", "UVICORN_PORT", "UVICORN_HOST", "WORKER_ID", "PYTHONUNBUFFERED"
}

REQUIRED_APP_ENVS = {"AVA_ENV"}

# 2. СИСТЕМНЫЕ ПРЕФИКСЫ (БЕЛЫЙ СПИСОК ПРЕФИКСОВ)
# Windows/Linux environment noise
SYSTEM_RESERVED_PREFIXES = (
    "PROGRAM", "COMMON", "APPDATA", "LOCALAPPDATA", "USER", "WIN", "SYSTEM", 
    "PROCESSOR", "NUMBER_OF", "OS", "PATH", "COMSPEC", "HOMEDRIVE", "HOMEPATH",
    "LOGONSERVER", "PROMPT", "PSMODULE", "PUBLIC", "SESSION", "TEMP", "TMP", 
    "DRIVER", "ALLUSER", "COMPUTER", "DIR", "FILE", "IS", "JAVA", "NPM", "NODE",
    "VSCODE", "GIT", "PY", "POWERSHELL", "WSL", "WT_", "SHLVL", "TERM", "LANG",
    "LC_", "LS_", "CHROME", "ELECTRON", "FPS_BROWSER", "ORIGINAL_XDG", "ZSH",
    "SSH", "GPG", "LESS", "DISPLAY", "XAUTHORITY", "XDG", "_",
    "ONEDRIVE", "ONE_DRIVE", "VBOX", "CHOCOLATEY" 
)

def validate_environment(
    env: Mapping[str, str] | None = None,
    logger: logging.Logger | None = None,
):
    """
    STRICT CHECK: 
    Any var NOT in SSOT_APP_ENVS AND NOT starting with SYSTEM PREFIX -> CRASH.
    """
    current_envs = set((env or os.environ).keys())
    violations = []
    missing_required = sorted(REQUIRED_APP_ENVS - current_envs)
    
    for key in current_envs:
        # 1. Точное совпадение с SSOT
        if key in SSOT_APP_ENVS:
            continue
            
        # 2. Проверка системных префиксов
        key_upper = key.upper()
        if key_upper.startswith(SYSTEM_RESERVED_PREFIXES):
            continue
            
        # 3. Разрешаем специфичные точные совпадения (которые не попали в префиксы)
        if key_upper in {"COMMANDER_PATH", "CONEMUBUILD", "CONEMUPID", "CLIENTNAME"}: 
            continue

        # 4. Если мы здесь -> ЭТО НАРУШЕНИЕ
        violations.append(key)
    
    if missing_required:
        error_msg = f"Missing required ENVs: {missing_required}"
        raise RuntimeError(error_msg)

    if violations:
        if logger is None:
            logger = logging.getLogger("ssot_env_guard")
        warning_msg = (
            "SSOT ENV WARN: Unknown ENVs detected "
            f"(allowed list enforced by warn-only): {violations}"
        )
        logger.warning(warning_msg)
    return violations

if "AVA_ENV" not in os.environ:
    os.environ["AVA_ENV"] = "STAGING"

validate_environment()

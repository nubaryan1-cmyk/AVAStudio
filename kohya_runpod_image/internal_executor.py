import subprocess
from dataclasses import dataclass
from typing import List, Dict

@dataclass
class ExecResult:
    stdout: str
    stderr: str
    returncode: int

# ЖЕСТКИЙ ALLOWLIST: Только разрешенные команды для обучения
ALLOW: Dict[str, List[str]] = {
    "kohya_train": ["python", "/workspace/kohya/train_network.py"],
    "kohya_probe": ["python", "/workspace/kohya/train_network.py", "--help"]
}

def execute_internal(command_key: str, args: List[str]) -> ExecResult:
    if command_key not in ALLOW:
        raise ValueError(f"Unauthorized command key: {command_key}")

    # Блокировка shell=True и запуск строго списком
    cmd = ALLOW[command_key] + list(args or [])
    p = subprocess.run(cmd, capture_output=True, text=True, shell=False)
    return ExecResult(stdout=p.stdout, stderr=p.stderr, returncode=p.returncode)
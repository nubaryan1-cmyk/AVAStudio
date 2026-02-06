"""
AVA IRONCLAD EXECUTOR
Security Level: MAXIMUM
Defense: Strict Whitelist Regex
"""
import subprocess
import re
import shlex

# STRICT ALLOWLIST REGEX: Alphanumeric, underscore, dash, dot, slash, equals, comma
# REJECTS: spaces, semicolons, pipes, backticks, $ variables, etc.
SAFE_ARG_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\./=,]+$")

ALLOWED_COMMANDS = {
    "python": "/usr/bin/python3",
    "git": "/usr/bin/git",
    "ls": "/usr/bin/ls"
}

def execute_internal(command_key: str, args: list, timeout=300):
    """
    Executes command ONLY if key is allowed and ALL args match safe regex.
    """
    if command_key not in ALLOWED_COMMANDS:
        raise PermissionError(f"SEC-001: Command '{command_key}' is NOT in allowlist!")

    # Validate ARGS
    for arg in args:
        s_arg = str(arg)
        if not SAFE_ARG_PATTERN.match(s_arg):
            raise ValueError(f"SEC-002: Malicious argument detected! Pattern mismatch: '{s_arg}'")

    # Construct command
    # shell=False is MANDATORY
    full_cmd = [ALLOWED_COMMANDS[command_key]] + args
    
    return subprocess.run(
        full_cmd,
        shell=False,
        capture_output=True,
        text=True,
        timeout=timeout
    )

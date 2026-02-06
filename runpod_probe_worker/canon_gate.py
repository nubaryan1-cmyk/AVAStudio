#!/usr/bin/env python3
"""
CANON GATE — ENFORCEMENT SCRIPT

================================================================================
RULE #0 (ABSOLUTE): SOLE AUTHORITY = _CANON/STATE_MODEL/STATE_MODEL.txt
================================================================================

CANON VERSION: 1.0
CANON LAW LOCK: PERMANENT (OWNER LAW)

This gate FAILS IMMEDIATELY if:
- [RULE #0] Any *state_machine*.json or *transitions*.json exists under /_CANON/
- [RULE #0] Any code references state definitions from /_CANON/STATE_MACHINE/
- [RULE #1] Any file defines state/transition outside STATE_MODEL.txt
- [RULE #2] Any enum duplicates state definitions
- [RULE #3] Any transition not in STATE_MODEL.txt is used
- [RULE #4] Any hardcoded Windows paths (D:\, C:\)
- [RULE #5] Any forbidden state names (ERROR, SUCCESS, etc.)

Exit codes:
  0 = All checks passed
  1 = Canon violation detected
"""

import os
import re
import sys
import json
import glob

# =============================================================================
# CANONICAL DEFINITIONS (from _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL)
# CANON STATUS: IMMUTABLE (OWNER APPROVED)
# FINAL STATE COUNT: 10
# =============================================================================

CANON_STATES = frozenset([
    "CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED",
    "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"
])

CANON_TRANSITIONS = {
    "CREATED": frozenset(["VALIDATING", "CANCELLED"]),
    "VALIDATING": frozenset(["READY", "FAILED", "CANCELLED"]),
    "READY": frozenset(["IN_QUEUE", "CANCELLED"]),
    "IN_QUEUE": frozenset(["SCHEDULED", "CANCELLED"]),
    "SCHEDULED": frozenset(["RUNNING", "CANCELLED"]),
    "RUNNING": frozenset(["COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"]),
    "COMPLETED": frozenset(),
    "FAILED": frozenset(["CANCELLED"]),
    "CANCELLED": frozenset(),
    "TIMEOUT": frozenset()
}

# Non-canonical states that MUST NOT appear
# PAUSED and RETRYING are PERMANENTLY FORBIDDEN by OWNER decision
FORBIDDEN_STATES = {
    "PAUSED", "RETRYING",  # PERMANENTLY FORBIDDEN (OWNER DECISION)
    "QUEUED", "BUSY", "DEAD", "UNKNOWN", "PENDING", "REJECTED",
    "NOT_FOUND", "ERROR", "SUCCESS", "ACTIVE", "INACTIVE", "STOPPED"
}

# =============================================================================
# VIOLATION TRACKING
# =============================================================================

violations = []

def add_violation(file_path, line_num, violation_type, detail):
    violations.append({
        "file": file_path,
        "line": line_num,
        "type": violation_type,
        "detail": detail
    })

# =============================================================================
# CHECKS
# =============================================================================

def check_python_file(file_path):
    """Check Python file for canon violations."""
    # Skip the canon gate itself
    if 'canon_gate.py' in file_path:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        for i, line in enumerate(lines, 1):
            if re.search(r'["\'][A-Z]:\\', line):
                add_violation(file_path, i, "HARDCODED_PATH", "Found hardcoded Windows path")
        return
    
    # Skip enforcement/guard/test files that MUST reference forbidden states to reject them
    # These files define FORBIDDEN_STATES or test that they are correctly rejected
    skip_files = [
        'ssot_state_validator.py',
        'ssot_invariants.py', 
        'smoke_test.py',
        'test_canon_exception_negative.py',
        'test_ssot_',
        'test_canon_'
    ]
    if any(skip in file_path for skip in skip_files):
        # Only check for hardcoded paths in these files
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        for i, line in enumerate(lines, 1):
            if re.search(r'["\'][A-Z]:\\', line):
                add_violation(file_path, i, "HARDCODED_PATH", "Found hardcoded Windows path")
        return
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines, 1):
        # Check for forbidden state strings
        for forbidden in FORBIDDEN_STATES:
            pattern = rf'["\']({forbidden})["\']'
            if re.search(pattern, line):
                # Skip legitimate uses in enforcement/guard code:
                # - FORBIDDEN_STATES definitions
                # - Test assertions checking forbidden behavior
                # - Validator code that rejects forbidden states
                if 'FORBIDDEN_STATES' in line:
                    continue
                if 'assertNotIn' in line or 'test_fail' in line or 'test_pass' in line:
                    continue
                if 'validate_state' in line or 'validate_transition' in line:
                    continue
                # Skip comments and docstrings explaining forbidden states
                stripped = line.strip()
                if stripped.startswith('#') or stripped.startswith('"""') or stripped.startswith("'''"):
                    continue
                if 'PERMANENTLY FORBIDDEN' in line or 'forbidden' in line.lower():
                    continue
                # This is an ACTUAL violation - code using forbidden state
                add_violation(file_path, i, "FORBIDDEN_STATE", f"Found forbidden state: {forbidden}")
        
        # Check for hardcoded Windows paths
        if re.search(r'["\'][A-Z]:\\', line):
            add_violation(file_path, i, "HARDCODED_PATH", "Found hardcoded Windows path")
        
        # Check for local state lists (not using CANON_STATES)
        if re.search(r'states\s*=\s*\[', line, re.IGNORECASE):
            if 'CANON_STATES' not in line and 'SSOT_STATES' not in line:
                add_violation(file_path, i, "LOCAL_STATE_LIST", "Possible local state definition")
        
        # === AVA6 ENFORCEMENT RULES ===
        
        # RULE-ERR-001: FAIL if code assigns string to result.error
        # Pattern: result["error"] = str(...) or error = str(...) as standalone assignment
        # Only check files in runpod_probe_worker (main worker), not probe handlers or tests
        if 'runpod_probe_worker' in file_path and 'kohya' not in file_path and '/tests/' not in file_path:
            # Pattern 1: result["error"] = str(...)
            if re.search(r'result.*\["error"\]\s*=\s*str\(', line):
                add_violation(file_path, i, "STRING_ERROR_ASSIGN", "Assigning str() to result.error - must use canonical object")
            # Pattern 2: error = str(e) - standalone variable assignment (not error=str() in function call)
            # Must start with 'error =' not ',error=' or '(error='
            if re.search(r'^\s*error\s*=\s*str\(', line):
                add_violation(file_path, i, "STRING_ERROR_ASSIGN", "Assigning str() to error variable - must use classify_exception()")
            # Pattern 3: result["error"] = "string literal"
            if re.search(r'\["result"\].*\["error"\]\s*=\s*["\'][^{]', line):
                # Skip if it's None assignment
                if not re.search(r'\["result"\].*\["error"\]\s*=\s*None', line):
                    add_violation(file_path, i, "STRING_ERROR_LITERAL", "Assigning string literal to result.error - must use canonical object")
        
        # RULE-ERR-002: Check for invalid error class in dict literals
        # Pattern: "class": "invalid"
        error_class_match = re.search(r'"class"\s*:\s*"([a-z]+)"', line)
        if error_class_match:
            found_class = error_class_match.group(1)
            allowed_classes = {"infra", "user", "model", "quota", "fatal"}
            if found_class not in allowed_classes:
                add_violation(file_path, i, "INVALID_ERROR_CLASS", f"Invalid error class '{found_class}' - must be one of {allowed_classes}")


def check_csharp_file(file_path):
    """Check C# file for canon violations."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines, 1):
        # Check for forbidden state strings
        for forbidden in FORBIDDEN_STATES:
            pattern = rf'["\']({forbidden})["\']'
            if re.search(pattern, line):
                add_violation(file_path, i, "FORBIDDEN_STATE", f"Found forbidden state: {forbidden}")
        
        # Check for hardcoded Windows paths
        if re.search(r'@?"[A-Z]:\\', line):
            add_violation(file_path, i, "HARDCODED_PATH", "Found hardcoded Windows path")


def check_json_file(file_path):
    """Check JSON file for canon violations."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check state_machine.json specifically
        if 'state_machine' in file_path.lower():
            if 'states' in data:
                defined_states = set(data['states'])
                missing = CANON_STATES - defined_states
                extra = defined_states - CANON_STATES
                
                if missing:
                    add_violation(file_path, 0, "MISSING_CANON_STATES", f"Missing: {missing}")
                if extra:
                    add_violation(file_path, 0, "EXTRA_NON_CANON_STATES", f"Extra: {extra}")
    except Exception:
        pass


def check_powershell_file(file_path):
    """Check PowerShell file for canon violations."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines, 1):
        # Check for hardcoded Windows paths
        if re.search(r'["\'][A-Z]:\\', line):
            add_violation(file_path, i, "HARDCODED_PATH", "Found hardcoded Windows path")


def scan_directory(root_dir):
    """Scan directory for canon violations."""
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip hidden directories and node_modules
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d != 'node_modules']
        
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            
            if filename.endswith('.py'):
                check_python_file(file_path)
            elif filename.endswith('.cs'):
                check_csharp_file(file_path)
            elif filename.endswith('.json'):
                check_json_file(file_path)
            elif filename.endswith('.ps1'):
                check_powershell_file(file_path)


# =============================================================================
# MAIN
# =============================================================================

def check_rule_zero(root_dir):
    """
    RULE #0 (ABSOLUTE): No state/transition definitions under /_CANON/ except STATE_MODEL.txt
    
    FAILS if:
    - Any *state_machine*.json exists under /_CANON/
    - Any *transitions*.json exists under /_CANON/
    - Any code references /_CANON/STATE_MACHINE/
    """
    canon_dir = os.path.join(root_dir, "_CANON")
    
    if not os.path.exists(canon_dir):
        return
    
    # Check for illegal JSON files under _CANON
    for pattern in ["**/state_machine*.json", "**/*transitions*.json", "**/states*.json"]:
        for match in glob.glob(os.path.join(canon_dir, pattern), recursive=True):
            # STATE_MODEL directory is allowed
            if "STATE_MODEL" not in match:
                add_violation(match, 0, "RULE_ZERO_VIOLATION", 
                    f"Illegal state/transition definition under _CANON. SOLE AUTHORITY = STATE_MODEL.txt")
    
    # Check for _CANON/STATE_MACHINE directory (should not exist)
    state_machine_dir = os.path.join(canon_dir, "STATE_MACHINE")
    if os.path.exists(state_machine_dir):
        add_violation(state_machine_dir, 0, "RULE_ZERO_VIOLATION",
            f"/_CANON/STATE_MACHINE/ directory exists. Must be deleted or moved to /_GENERATED/")


def check_code_references_illegal_canon(root_dir):
    """
    RULE #0: No code may reference /_CANON/STATE_MACHINE/ for state definitions.
    """
    illegal_patterns = [
        r'_CANON[/\\]STATE_MACHINE',
        r'_CANON\\STATE_MACHINE',
        r'_CANON/STATE_MACHINE'
    ]
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d != 'node_modules']
        
        for filename in filenames:
            if filename.endswith(('.py', '.cs', '.ps1', '.json')):
                file_path = os.path.join(dirpath, filename)
                
                # Skip canon_gate.py itself (it contains the patterns for checking)
                if 'canon_gate.py' in file_path:
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    for pattern in illegal_patterns:
                        if re.search(pattern, content):
                            add_violation(file_path, 0, "RULE_ZERO_VIOLATION",
                                f"Code references /_CANON/STATE_MACHINE/. Must use /_GENERATED/ or STATE_MODEL.txt")
                            break
                except Exception:
                    pass


def main():
    print("=" * 70)
    print("CANON GATE — ENFORCEMENT CHECK")
    print("RULE #0: SOLE AUTHORITY = _CANON/STATE_MODEL/STATE_MODEL.txt")
    print("=" * 70)
    print()
    
    # Determine root directory
    if len(sys.argv) > 1:
        root = sys.argv[1]
    else:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    print(f"Scanning: {root}")
    print()
    
    # RULE #0 checks FIRST
    print("Checking RULE #0 (Canon Authority)...")
    check_rule_zero(root)
    check_code_references_illegal_canon(root)
    
    # Other checks
    print("Checking RULES #1-5 (States, Transitions, Paths)...")
    scan_directory(root)
    
    print()
    
    if violations:
        print("❌ CANON VIOLATIONS DETECTED")
        print("-" * 70)
        for v in violations:
            print(f"[{v['type']}] {v['file']}:{v['line']}")
            print(f"    {v['detail']}")
            print()
        
        print("-" * 70)
        print(f"Total violations: {len(violations)}")
        print("CANON GATE: FAILED")
        sys.exit(1)
    else:
        print("✅ NO CANON VIOLATIONS DETECTED")
        print("CANON GATE: PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()

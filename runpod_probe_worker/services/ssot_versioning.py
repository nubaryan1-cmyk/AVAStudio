"""
SSOT VERSIONING ENFORCEMENT SERVICE

================================================================================
CANON AUTHORITY: _CANON/SEMANTICS/SSOT_VERSIONING.md v1.1
STATUS: ENFORCEMENT REQUIRED
================================================================================

This module provides SSOT version normalization and validation.
All job intake MUST use this module to ensure compliance.

DUAL-MODE SUPPORT:
- DEFAULT_SSOT_VERSION: Used for INCOMING/legacy jobs missing ssot_version
  (configurable via SSOT_DEFAULT_VERSION env var, defaults to "1.0")
- CURRENT_SSOT_VERSION: Used for NEW jobs created by create_canonical_job()
  (always "1.1", not configurable)
"""

import os
from typing import Any, Dict, Tuple
from datetime import datetime, timezone

# =============================================================================
# VERSION CONSTANTS
# =============================================================================

# DEFAULT for INCOMING/legacy jobs (env-configurable for dual-mode testing)
DEFAULT_SSOT_VERSION = os.getenv("SSOT_DEFAULT_VERSION", "1.0")

# CURRENT version for NEW jobs (always 1.1, not configurable)
CURRENT_SSOT_VERSION = "1.1"

SUPPORTED_MAJOR_VERSIONS = {1}  # Only major version 1 is supported

# =============================================================================
# EXCEPTIONS
# =============================================================================

class UnsupportedSsotVersionError(Exception):
    """Raised when job has unsupported SSOT version."""
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"Unsupported SSOT version: {version}")


# =============================================================================
# VERSION PARSING
# =============================================================================

def parse_version(version: str) -> Tuple[int, int]:
    """
    Parse MAJOR.MINOR version string.
    Returns (major, minor) tuple.
    """
    try:
        parts = version.strip().split(".")
        if len(parts) != 2:
            raise ValueError(f"Invalid version format: {version}")
        return int(parts[0]), int(parts[1])
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Cannot parse version '{version}': {e}")


# =============================================================================
# NORMALIZATION
# =============================================================================

def normalize_ssot_version(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize ssot_version in job contract.
    
    - If missing or empty -> set to DEFAULT_SSOT_VERSION ("1.0")
    - If present -> keep as-is
    
    Returns the modified job dict (mutates in place).
    """
    if "ssot_version" not in job or not job["ssot_version"]:
        job["ssot_version"] = DEFAULT_SSOT_VERSION
    return job


# =============================================================================
# VALIDATION
# =============================================================================

def validate_ssot_version(job: Dict[str, Any]) -> None:
    """
    Validate ssot_version in job contract.
    
    - Parses version string
    - Checks major version is supported
    - Raises UnsupportedSsotVersionError if not supported
    """
    version = job.get("ssot_version", DEFAULT_SSOT_VERSION)
    
    try:
        major, minor = parse_version(version)
    except ValueError:
        raise UnsupportedSsotVersionError(version)
    
    if major not in SUPPORTED_MAJOR_VERSIONS:
        raise UnsupportedSsotVersionError(version)


def is_version_supported(version: str) -> bool:
    """
    Check if version is supported without raising exception.
    """
    try:
        major, _ = parse_version(version)
        return major in SUPPORTED_MAJOR_VERSIONS
    except ValueError:
        return False


# =============================================================================
# JOB FAILURE FOR UNSUPPORTED VERSION
# =============================================================================

def fail_job_unsupported_version(job: Dict[str, Any], version: str) -> Dict[str, Any]:
    """
    Mark job as FAILED due to unsupported SSOT version.
    
    Sets:
    - state = "FAILED"
    - result.error = canonical error object
    - timestamps.finished = now
    
    Returns the modified job dict.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    job["state"] = "FAILED"
    
    if "timestamps" not in job:
        job["timestamps"] = {}
    job["timestamps"]["finished"] = now
    
    if "result" not in job:
        job["result"] = {"artifacts": [], "metrics": {}}
    
    job["result"]["error"] = {
        "class": "fatal",
        "code": "FATAL_UNSUPPORTED_SSOT_VERSION",
        "message": f"Unsupported SSOT version: {version}. Supported major versions: {sorted(SUPPORTED_MAJOR_VERSIONS)}"
    }
    
    return job


# =============================================================================
# INTAKE HANDLER
# =============================================================================

def process_job_intake(job: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """
    Process job at intake: normalize and validate ssot_version.
    
    Returns:
        (job, success) - modified job and whether it passed validation
    
    If validation fails, job is marked as FAILED with canonical error.
    """
    # Normalize first
    normalize_ssot_version(job)
    
    # Validate
    try:
        validate_ssot_version(job)
        return job, True
    except UnsupportedSsotVersionError as e:
        fail_job_unsupported_version(job, e.version)
        return job, False
# === MODULE ALIAS (CANON) ===
# === MODULE ALIAS (CANON) ===
# Prevent duplicate imports under different package roots (services.* vs runpod_probe_worker.services.*)
import sys as _sys

_name = __name__
_mod = _sys.modules.get(_name)

if _mod is not None:
    if _name.startswith("services."):
        _sys.modules.setdefault("runpod_probe_worker." + _name, _mod)
    elif _name.startswith("runpod_probe_worker.services."):
        _sys.modules.setdefault(_name.replace("runpod_probe_worker.", "", 1), _mod)
# === END MODULE ALIAS (CANON) ===

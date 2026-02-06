"""
Job Store (CANONICAL)

CANON AUTHORITY: _CANON/JOB_CONTRACT/job_contract.json
STATE AUTHORITY: _CANON/STATE_MODEL/STATE_MODEL.txt

Stores job records conforming to canonical job_contract schema.
All persistence uses atomic writes with file locking.
"""

import os
import json
import threading

# Storage location (ENV-based)
STORE_DIR = os.getenv(
    "AVA_JOB_STORE",
    os.path.join(os.getenv("AVA_STORAGE_ROOT", "/tmp/ava_storage"), "jobs")
)
LOCK = threading.Lock()


def _ensure_dir():
    """Ensure storage directory exists."""
    os.makedirs(STORE_DIR, exist_ok=True)


def _path(job_id: str) -> str:
    """Get file path for job record."""
    return os.path.join(STORE_DIR, f"{job_id}.json")


def save(job_id: str, data: dict) -> None:
    """
    Save job record atomically.
    
    SSOT: CS-001 — Job/state must be recoverable after crash.
    """
    _ensure_dir()
    path = _path(job_id)
    temp_path = path + ".tmp"
    
    with LOCK:
        # Write to temp file first (atomic write)
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # Atomic rename
        os.replace(temp_path, path)


def load(job_id: str) -> dict | None:
    """
    Load job record.
    
    Returns None if job not found.
    """
    path = _path(job_id)
    if not os.path.exists(path):
        return None
    
    with LOCK:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


def exists(job_id: str) -> bool:
    """Check if job exists."""
    return os.path.exists(_path(job_id))


def delete(job_id: str) -> bool:
    """Delete job record. Returns True if deleted."""
    path = _path(job_id)
    if os.path.exists(path):
        with LOCK:
            os.remove(path)
            return True
    return False


def list_jobs() -> list:
    """List all job IDs in store."""
    _ensure_dir()
    jobs = []
    for filename in os.listdir(STORE_DIR):
        if filename.endswith(".json"):
            jobs.append(filename[:-5])  # Remove .json extension
    return jobs

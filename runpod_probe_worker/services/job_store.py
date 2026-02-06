"""
Job Store (CANONICAL)

CANON AUTHORITY: _CANON/JOB_CONTRACT/job_contract.json
STATE AUTHORITY: _CANON/STATE_MODEL/STATE_MODEL.txt

Stores job records conforming to canonical job_contract schema.
All persistence uses atomic writes with file locking.
"""

import json
import os
import threading
from typing import Iterable

# Storage location (ENV-based)
STORE_DIR = os.getenv(
    "AVA_JOB_STORE",
    os.path.join(os.getenv("AVA_STORAGE_ROOT", "/tmp/ava_storage"), "jobs")
)
STORE_BACKEND = os.getenv("AVA_JOB_STORE_BACKEND", "local").lower()
S3_BUCKET = os.getenv("AVA_S3_BUCKET")
S3_PREFIX = os.getenv("AVA_S3_PREFIX", "jobs")
LOCK = threading.Lock()


def _ensure_dir():
    """Ensure storage directory exists."""
    os.makedirs(STORE_DIR, exist_ok=True)


def _path(job_id: str) -> str:
    """Get file path for job record."""
    return os.path.join(STORE_DIR, f"{job_id}.json")


def _s3_key(job_id: str) -> str:
    prefix = S3_PREFIX.rstrip("/")
    return f"{prefix}/{job_id}.json"


def _s3_client():
    import boto3

    return boto3.client("s3")


def _s3_list_keys(client) -> Iterable[str]:
    continuation_token = None
    while True:
        kwargs = {"Bucket": S3_BUCKET, "Prefix": f"{S3_PREFIX.rstrip('/')}/"}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = client.list_objects_v2(**kwargs)
        for item in response.get("Contents", []):
            yield item["Key"]
        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")


def save(job_id: str, data: dict) -> None:
    """
    Save job record atomically.
    
    SSOT: CS-001 — Job/state must be recoverable after crash.
    """
    if STORE_BACKEND == "s3":
        if not S3_BUCKET:
            raise RuntimeError("AVA_S3_BUCKET must be set for S3 job store.")
        client = _s3_client()
        payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        client.put_object(Bucket=S3_BUCKET, Key=_s3_key(job_id), Body=payload)
        return

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
    if STORE_BACKEND == "s3":
        if not S3_BUCKET:
            raise RuntimeError("AVA_S3_BUCKET must be set for S3 job store.")
        from botocore.exceptions import ClientError

        client = _s3_client()
        try:
            response = client.get_object(Bucket=S3_BUCKET, Key=_s3_key(job_id))
        except ClientError as exc:
            if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404:
                return None
            raise
        return json.loads(response["Body"].read().decode("utf-8"))

    path = _path(job_id)
    if not os.path.exists(path):
        return None

    with LOCK:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


def exists(job_id: str) -> bool:
    """Check if job exists."""
    if STORE_BACKEND == "s3":
        if not S3_BUCKET:
            raise RuntimeError("AVA_S3_BUCKET must be set for S3 job store.")
        from botocore.exceptions import ClientError

        client = _s3_client()
        try:
            client.head_object(Bucket=S3_BUCKET, Key=_s3_key(job_id))
            return True
        except ClientError as exc:
            if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404:
                return False
            raise

    return os.path.exists(_path(job_id))


def delete(job_id: str) -> bool:
    """Delete job record. Returns True if deleted."""
    if STORE_BACKEND == "s3":
        if not S3_BUCKET:
            raise RuntimeError("AVA_S3_BUCKET must be set for S3 job store.")
        client = _s3_client()
        client.delete_object(Bucket=S3_BUCKET, Key=_s3_key(job_id))
        return True

    path = _path(job_id)
    if os.path.exists(path):
        with LOCK:
            os.remove(path)
            return True
    return False


def list_jobs() -> list:
    """List all job IDs in store."""
    if STORE_BACKEND == "s3":
        if not S3_BUCKET:
            raise RuntimeError("AVA_S3_BUCKET must be set for S3 job store.")
        client = _s3_client()
        jobs = []
        for key in _s3_list_keys(client):
            if key.endswith(".json"):
                jobs.append(os.path.basename(key)[:-5])
        return jobs

    _ensure_dir()
    jobs = []
    for filename in os.listdir(STORE_DIR):
        if filename.endswith(".json"):
            jobs.append(filename[:-5])  # Remove .json extension
    return jobs

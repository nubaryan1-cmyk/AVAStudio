from datetime import datetime, timezone

def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def normalize(runpod_status: str):
    if runpod_status in ["IN_QUEUE", "INITIALIZING"]:
        return "IN_QUEUE"
    if runpod_status in ["RUNNING"]:
        return "RUNNING"
    if runpod_status in ["COMPLETED"]:
        return "COMPLETED"
    if runpod_status in ["FAILED", "CANCELLED", "TIMED_OUT"]:
        return "FAILED"
    return "FAILED"

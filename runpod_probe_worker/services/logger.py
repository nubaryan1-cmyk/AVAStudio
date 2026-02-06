import os
import json
import time

EVENTS_LOG = os.getenv(
    "AVA_EVENTS_LOG",
    os.path.join(os.getenv("AVA_STORAGE_ROOT", "/tmp/ava_storage"), "events.jsonl")
)

def log_event(event_type: str, **fields):
    """
    New-style logger:
    log_event("job_completed", job_id="...", worker_id="...")
    """
    os.makedirs(os.path.dirname(EVENTS_LOG), exist_ok=True)
    payload = {"ts": time.time(), "event": str(event_type)}
    payload.update(fields)

    with open(EVENTS_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def write(*args, **kwargs):
    """
    Backward-compatible adapter for legacy code.

    Supported legacy patterns:
      write("message")
      write("message", {"key": "value"})
      write({"event": "...", ...})
    """
    if not args:
        return

    # CASE 1: write("message")
    if len(args) == 1 and isinstance(args[0], str):
        log_event("log", message=args[0], **kwargs)
        return

    # CASE 2: write("message", dict)
    if len(args) >= 2 and isinstance(args[0], str) and isinstance(args[1], dict):
        payload = dict(args[1])
        payload["message"] = args[0]
        log_event("log", **payload)
        return

    # CASE 3: write(dict)
    if len(args) == 1 and isinstance(args[0], dict):
        payload = dict(args[0])
        event = payload.pop("event", "log")
        log_event(event, **payload)
        return

    # FALLBACK
    log_event("log", raw_args=str(args), raw_kwargs=str(kwargs))

def set_progress(job_id: str, progress: float, note: str = ""):
    """
    Progress: 0.0 → 1.0
    """
    log_event(
        "job_progress",
        job_id=job_id,
        progress=round(float(progress), 4),
        note=note
    )

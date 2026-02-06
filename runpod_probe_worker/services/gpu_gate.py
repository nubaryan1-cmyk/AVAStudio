import os
import time
import threading

_LOCK = threading.Lock()
_ACTIVE = 0

def _limit():
    return int(os.getenv("GPU_MAX_CONCURRENCY", "1"))

def _mode():
    # QUEUE or REJECT
    return os.getenv("GPU_CONCURRENCY_MODE", "QUEUE").upper()

def acquire(job_id=None):
    global _ACTIVE
    mode = _mode()
    limit = _limit()

    if mode == "REJECT":
        with _LOCK:
            if _ACTIVE >= limit:
                return False
            _ACTIVE += 1
            return True

    # QUEUE
    while True:
        with _LOCK:
            if _ACTIVE < limit:
                _ACTIVE += 1
                return True
        time.sleep(0.2)

def release():
    global _ACTIVE
    with _LOCK:
        if _ACTIVE > 0:
            _ACTIVE -= 1

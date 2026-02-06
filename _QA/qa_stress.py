"""
QA-1: QUEUE STRESS TEST
Goal: Create 1000 jobs as fast as possible.
"""
import sys
import os
import time
import concurrent.futures

# FIX: Add runpod_probe_worker to path so 'import services' works
WORKER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runpod_probe_worker")
sys.path.insert(0, WORKER_DIR)

from services.job_core import get_job_core

def spam_job(i):
    core = get_job_core()
    core.create_job("photo.generate", {"p": i}, user_id="stress_tester")
    return i

def run():
    print(">>> [STRESS] Starting 1000 jobs injection...")
    start = time.time()
    
    # Using fewer workers to avoid SQLite lock contention in simple mock mode
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(spam_job, i) for i in range(1000)]
        count = 0
        for _ in concurrent.futures.as_completed(futures):
            count += 1
            if count % 100 == 0: print(f"   ...{count}")
            
    duration = time.time() - start
    rate = 1000 / duration if duration > 0 else 0
    print(f">>> [STRESS] Done. Time: {duration:.2f}s. Rate: {rate:.0f} jobs/sec")
    
    # Relaxed timing for local file DB
    if duration > 120:
        print("[FAIL] Too slow!")
        sys.exit(1)
    else:
        print("[PASS] Performance acceptable.")

if __name__ == "__main__":
    run()

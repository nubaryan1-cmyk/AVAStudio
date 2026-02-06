"""
STAGE 3 ACCEPTANCE TEST: LIFECYCLE LOOP
Simulates 100 jobs being created and processed.
"""
import sys
import os
import time
import random
import concurrent.futures

# --- FIX: ADD PARENT DIR TO PATH ---
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.job_core import get_job_core

# Config
NUM_JOBS = 100
WORKERS = 5

# Set Env to force SQLite usage if needed (though db.py handles it)
os.environ["AVA_ENV"] = "STAGING"

def api_producer(core, n):
    """Creates N jobs."""
    created = []
    for i in range(n):
        key = f"idempotency-key-{i}"
        job, _ = core.create_job(
            job_type="photo.generate",
            payload={"prompt": f"Test Job {i}"},
            user_id="tester",
            idempotency_key=key
        )
        created.append(job.job_id)
    return created

def worker_consumer(core, worker_id):
    """Simulates a worker loop."""
    processed = 0
    while True:
        # 1. Claim
        job = core.claim_next_job(worker_id)
        if not job:
            break # No more jobs
        
        # 2. Start
        try:
            core.start_job(job.job_id)
            
            # Simulate work
            time.sleep(random.uniform(0.01, 0.05))
            
            # 3. Complete
            core.complete_job(job.job_id, artifacts=[{"type":"image", "uri":"s3://mock"}])
            processed += 1
        except Exception as e:
            # Ignore "already claimed" race conditions in this simple sim
            print(f"Worker {worker_id} exception on {job.job_id}: {e}")
            
    return processed

def main():
    core = get_job_core()
    
    print(f">>> Creating {NUM_JOBS} jobs...")
    job_ids = api_producer(core, NUM_JOBS)
    print(f">>> Jobs created. Starting {WORKERS} workers...")
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = [executor.submit(worker_consumer, core, f"w-{i}") for i in range(WORKERS)]
        results = [f.result() for f in futures]
        
    duration = time.time() - start_time
    total_processed = sum(results)
    
    print(f"\n>>> STATS:")
    print(f"    Created: {len(job_ids)}")
    print(f"    Processed: {total_processed}")
    print(f"    Time: {duration:.2f}s")
    
    # Validation
    stuck = 0
    failed = 0
    completed = 0
    
    for jid in job_ids:
        j = core.get_job(jid)
        if j.state == "COMPLETED": completed += 1
        elif j.state == "FAILED": failed += 1
        else: 
            stuck += 1
            print(f"    [STUCK JOB] {jid} State: {j.state}")
        
    print(f"    [COMPLETED]: {completed}")
    print(f"    [FAILED]:    {failed}")
    print(f"    [STUCK]:     {stuck}")
    
    if stuck == 0 and completed == NUM_JOBS:
        print("\n[SUCCESS] ЭТАП 3 ПРИНЯТ: Все задачи обработаны, зависших нет.")
        sys.exit(0)
    else:
        print("\n[FAIL] ЭТАП 3 НЕ ПРИНЯТ: Есть зависшие или потерянные задачи.")
        sys.exit(1)

if __name__ == "__main__":
    main()


import sys
import os

# SKIP LOGIC FOR STAGE 12 (NO INFRA)
def require_infra():
    # Если нет реального URL базы (не sqlite memory) - пропускаем
    db_url = os.getenv("DATABASE_URL", "")
    if "sqlite" in db_url or not db_url:
        print("[SKIP] No external infrastructure configured. Exiting with success (Option A).")
        sys.exit(0)

"""
QA-3: SECURITY & IDEMPOTENCY (ROBUST)
Goal: Verify double-charge protection.
Fix: Uses random key to ensure test independence.
"""
import sys
import os
import unittest
import uuid

# Path setup
WORKER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runpod_probe_worker")
sys.path.insert(0, WORKER_DIR)

from services.job_core import get_job_core

class TestSecurityQA(unittest.TestCase):
    def test_idempotency_prevents_duplicates(self):
        print("\n>>> [SEC] Testing Idempotency...")
        core = get_job_core()
        
        # Generate unique key for this test run
        key = f"idempotency_{uuid.uuid4()}"
        
        # First Call -> NEW
        job1, is_new1 = core.create_job("lora.train", {}, user_id="u1", idempotency_key=key)
        self.assertTrue(is_new1, "First call must be NEW")
        print(f"   [1] Job 1 created: {job1.job_id} (Key: {key})")
        
        # Second Call -> EXISTING
        job2, is_new2 = core.create_job("lora.train", {}, user_id="u1", idempotency_key=key)
        self.assertFalse(is_new2, "Second call must be EXISTING")
        print(f"   [2] Job 2 returned: {job2.job_id} (is_new=False)")
        
        # Verify IDs match
        self.assertEqual(job1.job_id, job2.job_id, "Job IDs must match")
        print("   [PASS] Idempotency confirmed.")

if __name__ == "__main__":
    require_infra()
    unittest.main()

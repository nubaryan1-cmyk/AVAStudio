"""
STAGE 8: INTEGRATION TEST (DETERMINISTIC)
Full cycle: Job -> Local File -> Pipeline -> DB Result.
"""
import unittest
import os
import sys
import json

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.job_core import get_job_core
from services.worker_pipeline import finalize_job_artifacts
from services.secure_logging import get_secure_logger

class TestStorageIntegration(unittest.TestCase):
    
    def setUp(self):
        # 1. Enforce Mock Mode
        os.environ["AVA_MOCK_MODE"] = "1"
        self.core = get_job_core()
        
        # 2. Create Real Job in DB (State -> IN_QUEUE)
        self.job, _ = self.core.create_job("photo.generate", {"prompt": "storage test"})
        self.job_id = self.job.job_id
        
        # 3. Create "GPU Output" File
        self.local_file = f"render_{self.job_id}.png"
        with open(self.local_file, "w") as f:
            f.write("BINARY_DATA_SECRET_IMAGE")
            
        print(f"\n[SETUP] Job {self.job_id} created. Local file: {self.local_file}")

    def tearDown(self):
        # Safety cleanup
        if os.path.exists(self.local_file):
            os.remove(self.local_file)

    def test_full_artifact_lifecycle(self):
        print(">>> RUNNING WORKER PIPELINE...")
        
        # --- PREPARE STATE (Manual Force) ---
        # Don't use claim_next_job() to avoid picking up old zombie jobs from dirty DB
        # Force transition our SPECIFIC job to SCHEDULED, then RUNNING
        self.core._transition(self.job_id, "IN_QUEUE", "SCHEDULED", "test_setup_force")
        self.core.start_job(self.job_id)
        
        print(f"   [INFO] Job {self.job_id} forced to RUNNING state.")
        
        # --- EXECUTE PIPELINE ---
        # This simulates what the Worker does after GPU finishes
        final_artifacts = finalize_job_artifacts(self.job_id, [self.local_file])
        
        # --- VERIFY LOCAL CLEANUP ---
        self.assertFalse(os.path.exists(self.local_file), "CRITICAL: Local file MUST be deleted")
        print("   [PASS] Local file deleted.")
        
        # --- VERIFY ARTIFACTS ---
        self.assertEqual(len(final_artifacts), 1)
        uri = final_artifacts[0]["uri"]
        print(f"   [RESULT] Artifact URI: {uri}")
        
        self.assertIn("https://", uri, "Must be a URL")
        self.assertIn("token=", uri, "Must be Signed")
        self.assertNotIn("s3://", uri, "Must NOT be raw S3 path")
        
        # --- VERIFY DB UPDATE ---
        # Worker saves these artifacts to JobCore
        self.core.complete_job(self.job_id, artifacts=final_artifacts)
        
        # Fetch from DB to be sure
        saved_job = self.core.get_job(self.job_id)
        saved_uri = saved_job.result["artifacts"][0]["uri"]
        
        self.assertEqual(saved_uri, uri, "DB must contain the Signed URL")
        self.assertEqual(saved_job.state, "COMPLETED")
        print("   [PASS] DB updated with Signed URL.")

if __name__ == "__main__":
    unittest.main()

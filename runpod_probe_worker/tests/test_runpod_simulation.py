"""
RUNPOD SIMULATION TEST
Simulates the RunPod environment and full job lifecycle.
"""
import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Add parent path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock RunPod BEFORE importing handler
sys.modules["runpod"] = MagicMock()
sys.modules["runpod.serverless"] = MagicMock()

# Setup Env for GPU Gate
os.environ["GPU_CONCURRENCY_MODE"] = "QUEUE"
os.environ["GPU_MAX_CONCURRENCY"] = "10"
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1" # Force mocks

from handler import handler

class TestRunPodLifecycle(unittest.TestCase):
    def test_hello_job_lifecycle(self):
        """
        Simulate a 'photo.generate' job from CREATED to COMPLETED.
        """
        event = {
            "input": {
                "job_id": "sim-job-001",
                "task": "photo.generate",
                "payload": {
                    "prompt": "A futuristic city with flying cars",
                    "width": 1024,
                    "height": 1024
                }
            }
        }
        
        print("\n>>> [SIMULATION] Starting Handler...")
        result = handler(event)
        
        print(f">>> [RESULT] State: {result.get('state')}")
        print(f">>> [ERROR]  Error: {result.get('result', {}).get('error')}")
        
        # Assertions
        self.assertEqual(result["state"], "COMPLETED")
        self.assertIsNone(result["result"]["error"])
        self.assertIn("artifacts", result["result"])
        
        # Verify timestamps
        ts = result["timestamps"]
        self.assertIsNotNone(ts["created"])
        self.assertIsNotNone(ts["started"])
        self.assertIsNotNone(ts["finished"])
        
        print(">>> [SUCCESS] Job finished successfully.")

if __name__ == "__main__":
    unittest.main()

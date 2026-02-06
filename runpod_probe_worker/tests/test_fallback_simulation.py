"""
STAGE 7: FALLBACK SIMULATION TEST (FIXED)
Scenario:
1. Configure Primary GPU.
2. Simulate failures to trip Circuit Breaker.
3. Verify routing switches to SaaS.
4. Verify metadata (is_fallback=True).
"""
import unittest
import os
import sys

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.router_policy import get_router, route_job

class TestFallback(unittest.TestCase):
    
    def setUp(self):
        # FIX: FORCE MOCK MODE FOR TESTS
        os.environ["AVA_MOCK_MODE"] = "1"
        
        self.router = get_router()
        # Reset CB
        self.router.cb._failures = {}
        self.router.cb._open_until = {}
        
        # Setup Env
        os.environ["AVA_VERSION_PHOTO"] = "v1"
        os.environ["GPU_PHOTO_URL_V1"] = "https://runpod-primary"

    def tearDown(self):
        if "AVA_MOCK_MODE" in os.environ:
            del os.environ["AVA_MOCK_MODE"]

    def test_circuit_breaker_switch(self):
        print("\n>>> TESTING FALLBACK SWITCH...")
        
        primary_url = "https://runpod-primary"
        
        # 1. Initial State: Should be Primary
        r1 = route_job("photo.generate")
        self.assertFalse(r1.is_fallback)
        self.assertIn("RunPod", r1.provider_instance.name)
        print("   [1] Initial route: GPU (OK)")
        
        # 2. Simulate Failures (Threshold = 3)
        print("   [2] Simulating 3 failures...")
        self.router.report_result(primary_url, success=False)
        self.router.report_result(primary_url, success=False)
        self.router.report_result(primary_url, success=False) # Trip!
        
        # 3. Next route should be Fallback
        r2 = route_job("photo.generate")
        self.assertTrue(r2.is_fallback)
        self.assertIn("Flux-SaaS", r2.provider_instance.name)
        print(f"   [3] Fallback triggered! Provider: {r2.provider_instance.name} (is_fallback=True)")
        
        # 4. Verify Execution via Fallback (Mocked)
        # Should now return success=True because AVA_MOCK_MODE=1
        result = r2.provider_instance.execute({"prompt": "test"})
        
        if not result["success"]:
            print(f"   [ERROR] Fallback failed: {result.get('error')}")
            
        self.assertTrue(result["success"])
        self.assertIn("mock-flux-saas", result["data"]["output"][0])
        print(f"   [4] Fallback execution result: {result['data']['output']}")

    def test_no_fallback_for_lora(self):
        """LoRA Training cannot have fallback."""
        os.environ["AVA_VERSION_LORA"] = "v1"
        os.environ["GPU_LORA_URL_V1"] = "https://runpod-lora"
        
        url = "https://runpod-lora"
        # Trip circuit
        self.router.report_result(url, False)
        self.router.report_result(url, False)
        self.router.report_result(url, False)
        
        print("\n>>> TESTING LORA NO-FALLBACK...")
        # Should raise RuntimeError because LoRA has no fallback
        with self.assertRaises(RuntimeError):
            route_job("lora.train")
        print("   [OK] LoRA correctly failed (no fallback available).")

if __name__ == "__main__":
    unittest.main()

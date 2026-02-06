"""
STAGE 6: FULL INFRASTRUCTURE PROOF
Verifies zero-downtime switching for ALL job types via ENV vars.
"""
import unittest
import os
import sys

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.router_policy import route_job, EndpointType

class TestFullInfraVersioning(unittest.TestCase):
    
    def setUp(self):
        # Clear Env to known state
        self.keys = [
            "AVA_VERSION_PHOTO", "GPU_PHOTO_URL_V1", "GPU_PHOTO_URL_V2",
            "AVA_VERSION_VIDEO", "GPU_VIDEO_URL_V1", "GPU_VIDEO_URL_V2",
            "AVA_VERSION_LORA",  "GPU_LORA_URL_V1",  "GPU_LORA_URL_V2"
        ]
        self._stash = {k: os.environ.get(k) for k in self.keys}
        for k in self.keys: 
            if k in os.environ: del os.environ[k]

    def tearDown(self):
        for k, v in self._stash.items():
            if v: os.environ[k] = v

    def test_photo_switch(self):
        print("\n>>> TESTING PHOTO SWITCH (Zero Downtime)...")
        os.environ["GPU_PHOTO_URL_V1"] = "https://runpod/photo-v1"
        os.environ["GPU_PHOTO_URL_V2"] = "https://runpod/photo-v2"
        
        # V1 Active
        os.environ["AVA_VERSION_PHOTO"] = "v1"
        r1 = route_job("photo.generate")
        self.assertEqual(r1.endpoint_url, "https://runpod/photo-v1")
        print(f"   [OK] v1 -> {r1.endpoint_url}")

        # SWITCH to V2
        os.environ["AVA_VERSION_PHOTO"] = "v2"
        r2 = route_job("photo.generate")
        self.assertEqual(r2.endpoint_url, "https://runpod/photo-v2")
        print(f"   [OK] v2 -> {r2.endpoint_url}")

    def test_video_switch(self):
        print("\n>>> TESTING VIDEO SWITCH...")
        os.environ["GPU_VIDEO_URL_V1"] = "https://runpod/video-wan"
        os.environ["GPU_VIDEO_URL_V2"] = "https://runpod/video-kling"
        
        os.environ["AVA_VERSION_VIDEO"] = "v2"
        r = route_job("video.generate")
        self.assertEqual(r.endpoint_url, "https://runpod/video-kling")
        print(f"   [OK] v2 (Video) -> {r.endpoint_url}")

    def test_lora_switch(self):
        print("\n>>> TESTING LORA SWITCH...")
        os.environ["GPU_LORA_URL_V1"] = "https://runpod/kohya-stable"
        
        os.environ["AVA_VERSION_LORA"] = "v1"
        r = route_job("lora.train")
        self.assertEqual(r.endpoint_url, "https://runpod/kohya-stable")
        self.assertEqual(r.endpoint_type, EndpointType.LORA_TRAIN)
        print(f"   [OK] v1 (LoRA) -> {r.endpoint_url}")

if __name__ == "__main__":
    unittest.main()

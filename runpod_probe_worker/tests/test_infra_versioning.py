"""
STAGE 6: INFRA VERSIONING TEST (LEGACY COMPAT)
"""
import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.router_policy import route_job

class TestInfraVersioningLegacy(unittest.TestCase):
    def setUp(self):
        # Clean Env
        keys = ["AVA_VERSION_PHOTO", "GPU_PHOTO_URL", "GPU_PHOTO_URL_V1", "GPU_PHOTO_URL_V2"]
        self._stash = {k: os.environ.get(k) for k in keys}
        for k in keys: 
            if k in os.environ: del os.environ[k]

    def tearDown(self):
        for k, v in self._stash.items():
            if v: os.environ[k] = v

    def test_legacy_fallback_url(self):
        """Test that router accepts unversioned GPU_PHOTO_URL as v1 fallback."""
        os.environ["GPU_PHOTO_URL"] = "https://runpod.io/legacy"
        # AVA_VERSION_PHOTO defaults to v1
        
        res = route_job("photo.generate")
        self.assertEqual(res.endpoint_url, "https://runpod.io/legacy")
        self.assertEqual(res.version, "v1")

    def test_version_switch(self):
        os.environ["GPU_PHOTO_URL_V1"] = "https://v1"
        os.environ["GPU_PHOTO_URL_V2"] = "https://v2"
        
        os.environ["AVA_VERSION_PHOTO"] = "v2"
        res = route_job("photo.generate")
        self.assertEqual(res.endpoint_url, "https://v2")

if __name__ == "__main__":
    unittest.main()

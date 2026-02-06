"""
STAGE 8: STORAGE PIPELINE PROOF (FIXED)
Verifies:
1. File uploaded to S3 (Mock).
2. Signed URL generated.
3. Local file deleted.
4. Secrets redacted from logs.
"""
import unittest
import os
import sys
import logging
from io import StringIO

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import CLASS, not just singleton
from services.artifacts import ArtifactStorage
from services.secure_logging import get_secure_logger

class TestStoragePipeline(unittest.TestCase):
    
    def setUp(self):
        # 1. Set Mock Mode FIRST
        os.environ["AVA_MOCK_MODE"] = "1"
        
        # 2. Instantiate NEW storage object (reads env var correctly)
        self.storage = ArtifactStorage()
        
        # Create dummy artifact
        self.local_file = "test_artifact.png"
        with open(self.local_file, "w") as f:
            f.write("fake image data")

    def tearDown(self):
        if os.path.exists(self.local_file):
            os.remove(self.local_file)
        if "AVA_MOCK_MODE" in os.environ:
            del os.environ["AVA_MOCK_MODE"]

    def test_pipeline_flow(self):
        print("\n>>> TESTING STORAGE PIPELINE...")
        
        # 1. Upload
        s3_uri = self.storage.upload_file(self.local_file, "user123/job456/output.png")
        
        # Assertions
        self.assertTrue(s3_uri.startswith("s3://"), "Must return S3 URI")
        self.assertIn("ava-storage", s3_uri)
        print(f"   [1] Uploaded: {s3_uri}")
        
        # 2. Sign URL
        signed_url = self.storage.get_signed_url(s3_uri)
        self.assertIn("https://", signed_url)
        self.assertIn("token=signed", signed_url)
        print(f"   [2] Signed URL: {signed_url}")
        
        # 3. Cleanup
        self.storage.cleanup(self.local_file)
        self.assertFalse(os.path.exists(self.local_file), "Local file must be deleted")
        print(f"   [3] Local cleanup verified.")

    def test_log_sanitization(self):
        print("\n>>> TESTING LOG SANITIZATION...")
        
        stream = StringIO()
        logger = get_secure_logger("test_sec")
        
        # Ensure we don't duplicate handlers if test runs multiple times
        logger.handlers = [] 
        handler = logging.StreamHandler(stream)
        
        # Manually apply filter since we reset handlers
        from services.secure_logging import SecurityFilter
        handler.addFilter(SecurityFilter())
        logger.addHandler(handler)
        
        # Log sensitive info
        secret = "sk-1234567890abcdef"
        logger.info(f"Connecting with MOCK_KEY ={secret}")
        
        output = stream.getvalue()
        print(f"   [Raw Output]: {output.strip()}")
        
        self.assertNotIn(secret, output, "Secret leaked in logs!")
        self.assertIn("***REDACTED***", output, "Redaction failed")
        print("   [OK] Secrets masked.")

if __name__ == "__main__":
    unittest.main()


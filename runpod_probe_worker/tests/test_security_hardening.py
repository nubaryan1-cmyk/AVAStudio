"""
STAGE 5: STRICT SECURITY TEST
"""
import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.internal_executor import execute_internal
from services.authn import SupabaseJWTVerifier
from services import config

class TestSecurityHardening(unittest.TestCase):
    
    @patch("subprocess.run")
    def test_valid_args_accepted(self, mock_run):
        """
        Verify safe args pass validation.
        Mocks subprocess so we rely only on logic, not OS.
        """
        mock_run.return_value.returncode = 0
        
        # Valid inputs
        safe_args = ["-la", "/tmp/file.txt", "--model=sdxl", "step=100"]
        
        # Should NOT raise exception
        execute_internal("ls", safe_args)
        
        # Verify it actually tried to run
        mock_run.assert_called_once()
        print("\n      [CHECK] Safe args passed validation logic.")

    def test_rce_injection_rejected(self):
        """Try to inject command separators and verify SEC-002 rejection."""
        malicious_inputs = ["; rm -rf /", "| echo hacked", "$(whoami)", "test space"]
        for payload in malicious_inputs:
            with self.assertRaises(ValueError) as cm:
                execute_internal("python", ["train.py", payload])
            self.assertIn("SEC-002", str(cm.exception))
            
    def test_prod_rejects_dev_token(self):
        os.environ["AVA_ENV"] = "PROD"
        os.environ["DATABASE_URL"] = "postgresql://mock:5432/db" # Satisfy boot gate
        config._config = None # Reset singleton
        
        verifier = SupabaseJWTVerifier()
        result = verifier.verify("dev_token")
        self.assertIsNone(result, "PROD must reject dev_token")

if __name__ == "__main__":
    unittest.main()

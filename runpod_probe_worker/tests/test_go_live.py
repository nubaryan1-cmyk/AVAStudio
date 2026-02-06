"""
STAGE 13: GO LIVE PROOF (FINAL)
Verifies:
1. Prod Gate blocks missing Sentry.
2. Handler actually calls Sentry on crash.
3. Metrics report reflects REAL isolated data.
"""
import unittest
import os
import sys
import json
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock Sentry BEFORE imports
sys.modules["sentry_sdk"] = MagicMock()

import prod_gate
from services import metrics_exporter
from handler import handler
from services.db import get_db

class TestGoLiveFinal(unittest.TestCase):
    
    def setUp(self):
        # Isolate DB
        self.db_path = "ava_stage13_metrics.db"
        os.environ["AVA_DB_PATH"] = self.db_path
        
        # Init Schema
        db = get_db()
        # Reset connection to pick up new path
        if hasattr(db, "conn"): db.conn.close() 
        db.__init__() 
        db.init_schema()

    def tearDown(self):
        if os.path.exists(self.db_path):
            try: os.remove(self.db_path)
            except: pass

    def test_prod_gate_enforces_sentry(self):
        """1. Gate must BLOCK if SENTRY_DSN is missing in PROD."""
        os.environ["AVA_ENV"] = "PROD"
        os.environ["DATABASE_URL"] = "postgres://..."
        os.environ["STRIPE_SECRET_KEY"] = "sk_live_..."
        if "SENTRY_DSN" in os.environ: del os.environ["SENTRY_DSN"]
        
        print("\n>>> [TEST 1] PROD Gate Sentry Check...")
        with self.assertRaises(SystemExit):
            prod_gate.check_prod_readiness()
        print("   [PASS] Blocked start without Sentry.")

    @patch("services.telemetry.sentry_sdk")
    def test_runtime_telemetry(self, mock_sentry):
        """2. Handler must call capture_exception on crash."""
        os.environ["AVA_ENV"] = "PROD"
        os.environ["SENTRY_DSN"] = "https://fake@sentry.io/1"
        
        # Re-init telemetry with PROD env
        from services.telemetry import init_telemetry
        init_telemetry()
        
        print("\n>>> [TEST 2] Runtime Telemetry Capture...")
        event = {"input": {"job_id": "crash-test", "simulate_crash": True}}
        
        handler(event)
        
        # Verify Sentry was called
        mock_sentry.capture_exception.assert_called_once()
        print("   [PASS] Sentry capture_exception called.")

    def test_metrics_accuracy(self):
        """3. Metrics must reflect exact DB state."""
        print("\n>>> [TEST 3] Metrics Accuracy...")
        db = get_db()
        
        # Inject exact data: 2 IN_QUEUE, 3 FAILED
        with db.get_connection() as conn:
            conn.execute("INSERT INTO jobs (job_id, job_type, state, created_at, payload_json) VALUES ('1', 'p', 'IN_QUEUE', 0, '{}')")
            conn.execute("INSERT INTO jobs (job_id, job_type, state, created_at, payload_json) VALUES ('2', 'p', 'IN_QUEUE', 0, '{}')")
            conn.execute("INSERT INTO jobs (job_id, job_type, state, created_at, payload_json) VALUES ('3', 'p', 'FAILED', 9999999999, '{}')")
            conn.execute("INSERT INTO jobs (job_id, job_type, state, created_at, payload_json) VALUES ('4', 'p', 'FAILED', 9999999999, '{}')")
            conn.execute("INSERT INTO jobs (job_id, job_type, state, created_at, payload_json) VALUES ('5', 'p', 'FAILED', 9999999999, '{}')")
            conn.commit()
            
        stats = metrics_exporter.get_snapshot()
        
        print(f"   [DATA] Queue: {stats['queue_depth']}, Failed 24h: {stats['failed_24h']}")
        
        self.assertEqual(stats["queue_depth"], 2, "Queue depth must be 2")
        self.assertEqual(stats["failed_24h"], 3, "Failed count must be 3")
        print("   [PASS] Metrics match DB exactly.")

if __name__ == "__main__":
    unittest.main()

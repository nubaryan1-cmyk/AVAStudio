"""
STAGE 9: BILLING & QUOTA INTEGRATION
Scenario:
1. User starts as FREE (Limit 5).
2. Uses up quota.
3. Next job fails (Quota Exceeded).
4. Webhook arrives (Upgrade to PRO).
5. Next job succeeds.
"""
import unittest
import os
import sys
import json
import time

# Inject path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.db import get_db
from services.quotas import get_quota
from services.billing_stripe import get_billing

class TestBillingCycle(unittest.TestCase):
    
    def setUp(self):
        os.environ["AVA_MOCK_MODE"] = "1"
        self.db = get_db()
        self.db.init_schema()
        self.quota = get_quota()
        self.billing = get_billing()
        
        self.user_id = "user_broke"
        
        # Reset User
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM users WHERE user_id = ?", (self.user_id,))
            conn.execute("DELETE FROM jobs WHERE user_id = ?", (self.user_id,))
            conn.execute("INSERT INTO users (user_id, plan) VALUES (?, ?)", (self.user_id, "FREE"))
            conn.commit()

    def create_dummy_job(self):
        with self.db.get_connection() as conn:
            conn.execute("""
                INSERT INTO jobs (job_id, user_id, job_type, state, payload_json, created_at)
                VALUES (?, ?, 'photo.generate', 'COMPLETED', '{}', ?)
            """, (f"job_{time.time()}", self.user_id, time.time()))
            conn.commit()

    def test_upgrade_flow(self):
        print("\n>>> TESTING BILLING FLOW...")
        
        # 1. Consume Free Quota (Limit 5)
        print("   [1] Consuming FREE quota (5 jobs)...")
        for i in range(5):
            self.quota.check_quota(self.user_id, "photo.generate") # Should pass
            self.create_dummy_job()
            
        # 2. Verify Block
        print("   [2] Trying 6th job (Should FAIL)...")
        with self.assertRaises(ValueError) as cm:
            self.quota.check_quota(self.user_id, "photo.generate")
        self.assertIn("QUOTA_EXCEEDED", str(cm.exception))
        print("       -> Blocked correctly.")

        # 3. Simulate Payment Webhook
        print("   [3] Webhook: Payment Received -> PRO Plan")
        payload = json.dumps({
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": "cus_123",
                    "metadata": {"user_id": self.user_id},
                    "items": {"data": [{"price": {"nickname": "PRO_MONTHLY"}}]}
                }
            }
        }).encode("utf-8")
        
        self.billing.process_webhook(payload, "mock_sig")
        
        # 4. Verify Unblock
        print("   [4] Trying 6th job again (Should PASS)...")
        try:
            self.quota.check_quota(self.user_id, "photo.generate")
            print("       -> Success! User is PRO.")
        except Exception as e:
            self.fail(f"User should be unlocked! Error: {e}")

        # 5. Check Feature Gating (Video is PRO only)
        # Should work now
        self.quota.check_quota(self.user_id, "video.generate")
        print("   [5] Video access confirmed.")

if __name__ == "__main__":
    unittest.main()
